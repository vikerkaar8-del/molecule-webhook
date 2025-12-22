/****************************************************
 * Aromat CashFlow Bot — Render + Google Sheets
 * ✅ recalcDay (порт из Apps Script)
 ****************************************************/

import express from 'express';
import fetch from 'node-fetch';
import { google } from 'googleapis';

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const PORT = process.env.PORT || 3000;

// Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979', '499185572'];

// InSales
const INS_API_KEY  = process.env.INS_API_KEY;
const INS_PASSWORD = process.env.INS_PASSWORD;
const INS_DOMAIN   = 'aromat.ee';
const INS_PER_PAGE = 50;

// Google Sheets
const SPREADSHEET_ID = '15S59Ms36TugiQAvxgLd5AX8urPVao5Quo0mnMvNt6aY';
const SHEET_DAILY_SALES = 'DailySales';

// ================== GOOGLE AUTH ==================
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

// ================== HELPERS ==================
async function telegram(method, payload) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  };
  if (keyboard) payload.reply_markup = keyboard;
  await telegram('sendMessage', payload);
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт за дату' }],
      [{ text: '🔄 Пересчитать день' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

function isAllowed(userId) {
  return ALLOWED_USERS.includes(String(userId));
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// ================== INS SALES ==================
async function fetchOrdersForDate(dateStr) {
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd   = new Date(`${dateStr}T23:59:59Z`);

  const authHeader =
    'Basic ' + Buffer.from(`${INS_API_KEY}:${INS_PASSWORD}`).toString('base64');

  let page = 1;
  let all = [];

  while (true) {
    const url =
      `https://${INS_DOMAIN}/admin/orders.json?per_page=${INS_PER_PAGE}&page=${page}&order=created_at+desc`;

    const res = await fetch(url, {
      headers: { Authorization: authHeader }
    });

    const data = await res.json();
    if (!data.length) break;

    for (const o of data) {
      const created = new Date(o.created_at);
      if (created >= dayStart && created <= dayEnd) {
        if (isPaidOrder(o)) all.push(o);
      }
    }

    const lastCreated = new Date(data[data.length - 1].created_at);
    if (lastCreated < dayStart) break;

    page++;
    if (page > 200) break;
  }

  return all;
}

function isPaidOrder(o) {
  return (
    o.financial_status === 'paid' ||
    o.paid === true ||
    o.paid_at
  );
}

function paymentTitle(o) {
  return (
    o.payment_title ||
    o.payment_method?.title ||
    o.payment_gateway ||
    '—'
  );
}

// ================== GOOGLE SHEETS ==================
async function upsertDailySales(dateStr, sums, ordersCount) {
  const range = `${SHEET_DAILY_SALES}!A2:I`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const rows = res.data.values || [];
  let rowIndex = rows.findIndex(r => r[0] === dateStr);

  const row = [
    dateStr,
    sums.banks_1,
    sums.banks_2,
    sums.card,
    sums.paypal,
    sums.transfer,
    sums.total,
    ordersCount,
    'EUR'
  ];

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_DAILY_SALES}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_DAILY_SALES}!A${rowIndex + 2}:I${rowIndex + 2}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
  }
}

// ================== 🔄 RECALC DAY ==================
async function recalcDay(dateStr) {
  const orders = await fetchOrdersForDate(dateStr);

  const sums = {
    banks_1: 0,
    banks_2: 0,
    card: 0,
    paypal: 0,
    transfer: 0,
    total: 0
  };

  for (const o of orders) {
    const amount = Number(o.total_price || 0);
    sums.total += amount;

    const pay = paymentTitle(o);

    if (pay.includes('банки') && pay.includes('EE')) sums.banks_1 += amount;
    else if (pay.includes('банки')) sums.banks_2 += amount;
    else if (pay.includes('карт')) sums.card += amount;
    else if (pay.includes('PayPal')) sums.paypal += amount;
    else if (pay.includes('перевод')) sums.transfer += amount;
  }

  await upsertDailySales(dateStr, sums, orders.length);
}

// ================== WEBHOOK ==================
app.post('/telegram', async (req, res) => {
  try {
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
      await sendMessage(
        chatId,
        '✅ <b>Aromat CashFlow</b>\nGoogle Sheets подключены.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    if (text.includes('Пересчитать')) {
      await sendMessage(chatId, 'Введите дату: YYYY-MM-DD');
      return res.sendStatus(200);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      await recalcDay(text);
      await sendMessage(chatId, `✅ Пересчитано: <b>${text}</b>`, mainKeyboard());
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard());
    res.sendStatus(200);

  } catch (e) {
    console.error(e);
    res.sendStatus(200);
  }
});

// ================== HEALTH ==================
app.get('/', (_, res) => {
  res.send('Aromat CashFlow webhook OK');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
