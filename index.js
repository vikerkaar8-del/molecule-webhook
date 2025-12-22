import express from 'express';
import fetch from 'node-fetch';
import { google } from 'googleapis';

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 10000;

/* Telegram */
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979','499185572'];

/* Google Sheets */
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_DAILY = 'DailySales';

/* InSales */
const INS_API_KEY  = process.env.INS_API_KEY;
const INS_PASSWORD = process.env.INS_PASSWORD;
const INS_DOMAIN   = 'aromat.ee';
const INS_PER_PAGE = 50;

/* ================= STATE ================= */

const userState = new Map();

/* ================= GOOGLE ================= */

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

/* ================= TELEGRAM ================= */

async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (keyboard) payload.reply_markup = keyboard;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт за дату' }, { text: '🔄 Пересчитать день' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true,
  };
}

function isAllowed(userId) {
  return ALLOWED_USERS.includes(String(userId));
}

function isDate(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text);
}

/* ================= InSales ================= */

async function fetchOrdersForDate(date) {
  const authHeader =
    'Basic ' + Buffer.from(`${INS_API_KEY}:${INS_PASSWORD}`).toString('base64');

  const start = new Date(`${date}T00:00:00`);
  const end   = new Date(`${date}T23:59:59`);

  let page = 1;
  let orders = [];

  while (true) {
    const url =
      `https://${INS_DOMAIN}/admin/orders.json` +
      `?per_page=${INS_PER_PAGE}&page=${page}&order=created_at+desc`;

    const res = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    const chunk = await res.json();
    if (!chunk || !chunk.length) break;

    for (const o of chunk) {
      const created = new Date(o.created_at);
      if (created >= start && created <= end) {
        orders.push(o);
      }
      if (created < start) return orders;
    }

    page++;
    if (page > 200) break;
  }

  return orders;
}

function isPaid(order) {
  if (order.financial_status === 'paid') return true;
  if (order.payment_state === 'paid') return true;
  if (order.paid === true) return true;
  if (order.paid_at) return true;
  return false;
}

function paymentTitle(order) {
  return (
    order.payment_title ||
    order.payment_method?.title ||
    order.payment_gateway ||
    '—'
  );
}

/* ================= DAILY RECALC ================= */

async function recalcDay(date) {
  const orders = await fetchOrdersForDate(date);
  const paid = orders.filter(isPaid);

  const sums = {
    banks_1: 0,
    banks_2: 0,
    card: 0,
    paypal: 0,
    transfer: 0,
    total: 0,
  };

  paid.forEach(o => {
    const amount = Number(o.total_price || 0);
    const pay = paymentTitle(o);
    sums.total += amount;

    if (pay.includes('банки') && pay.includes('FI')) sums.banks_1 += amount;
    else if (pay.includes('банки')) sums.banks_2 += amount;
    else if (pay.includes('карт')) sums.card += amount;
    else if (pay.includes('PayPal')) sums.paypal += amount;
    else if (pay.includes('перевод')) sums.transfer += amount;
  });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_DAILY}!A:J`,
  });

  const rows = res.data.values || [];
  let rowIndex = rows.findIndex(r => r[0] === date);

  const row = [
    date,
    sums.banks_1.toFixed(2),
    sums.banks_2.toFixed(2),
    sums.card.toFixed(2),
    sums.paypal.toFixed(2),
    sums.transfer.toFixed(2),
    sums.total.toFixed(2),
    paid.length,
    'EUR',
    'paid only'
  ];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_DAILY}!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } else {
    const r = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_DAILY}!A${r}:J${r}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  }

  return row;
}

/* ================= REPORT ================= */

function formatReport(r) {
  return (
    `📊 <b>Отчёт за ${r[0]}</b>\n` +
    `Оплаченных заказов: <b>${r[7]}</b>\n\n` +
    `🏦 Банки 1: <b>${r[1]} €</b>\n` +
    `🏦 Банки 2: <b>${r[2]} €</b>\n` +
    `💳 Карта: <b>${r[3]} €</b>\n` +
    `🅿️ PayPal: <b>${r[4]} €</b>\n` +
    `🏛 Перевод: <b>${r[5]} €</b>\n\n` +
    `💶 <b>Итого: ${r[6]} €</b>`
  );
}

/* ================= EXPRESS ================= */

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || '').trim();

  if (!isAllowed(userId)) {
    await sendMessage(chatId, '⛔ Нет доступа');
    return res.sendStatus(200);
  }

  if (text === '/start') {
    userState.clear();
    await sendMessage(chatId, '✅ Aromat CashFlow\nGoogle Sheets подключены.', mainKeyboard());
    return res.sendStatus(200);
  }

  if (text.includes('Пересчитать день')) {
    userState.set(chatId, 'WAIT_RECALC');
    await sendMessage(chatId, 'Введите дату: <code>YYYY-MM-DD</code>', mainKeyboard());
    return res.sendStatus(200);
  }

  if (text.includes('Отчёт за дату')) {
    userState.set(chatId, 'WAIT_REPORT');
    await sendMessage(chatId, 'Введите дату: <code>YYYY-MM-DD</code>', mainKeyboard());
    return res.sendStatus(200);
  }

  if (isDate(text)) {
    const mode = userState.get(chatId);
    userState.delete(chatId);

    if (mode === 'WAIT_RECALC') {
      const row = await recalcDay(text);
      await sendMessage(chatId, '✅ Пересчитано\n\n' + formatReport(row), mainKeyboard());
      return res.sendStatus(200);
    }

    if (mode === 'WAIT_REPORT') {
      const resSheet = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_DAILY}!A:J`,
      });
      const rows = resSheet.data.values || [];
      const row = rows.find(r => r[0] === text);
      if (!row) {
        await sendMessage(chatId, `❌ Нет данных за ${text}`, mainKeyboard());
      } else {
        await sendMessage(chatId, formatReport(row), mainKeyboard());
      }
      return res.sendStatus(200);
    }
  }

  await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard());
  res.sendStatus(200);
});

app.get('/', (_, res) => res.send('OK'));
app.listen(PORT, () => console.log('🚀 Server started'));
