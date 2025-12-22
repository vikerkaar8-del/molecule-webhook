/****************************************************
 * Aromat CashFlow Bot — RENDER WEBHOOK + GOOGLE SHEETS
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

// Google Sheets
const SPREADSHEET_ID = '15S59Ms36TugiQAvxgLd5AX8urPVao5Quo0mnMvNt6aY';
const SHEET_NAME = 'DailySales';

// ================== TELEGRAM HELPERS ==================
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
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (keyboard) payload.reply_markup = keyboard;
  await telegram('sendMessage', payload);
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт за дату' }, { text: '📅 Период (отчёт)' }],
      [{ text: '💰 Поступления на дату' }, { text: '🔄 Пересчитать день' }],
      [{ text: '🔁 Пересчитать период' }, { text: '🧹 Очистить период' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

function isAllowed(userId) {
  return ALLOWED_USERS.includes(String(userId));
}

// ================== GOOGLE SHEETS ==================
function getGoogleAuth() {
  const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  return new google.auth.JWT(
    json.client_email,
    null,
    json.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
}

async function getDailySalesByDate(date) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:Z`
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return null;

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const row = dataRows.find(r => r[0] === date);
  if (!row) return null;

  const result = {};
  headers.forEach((h, i) => {
    result[h] = row[i] || '0';
  });

  return result;
}

// ================== WEBHOOK ==================
app.post('/telegram', async (req, res) => {
  try {
    const msg = req.body.message;
    if (!msg) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = (msg.text || '').trim();

    if (!isAllowed(userId)) {
      await sendMessage(chatId, '⛔ Нет доступа');
      return res.sendStatus(200);
    }

    if (text === '/start') {
      await sendMessage(
        chatId,
        '✅ <b>Aromat CashFlow</b>\n\n' +
        'Бот работает через <b>Render webhook</b>.\n' +
        'Google Sheets подключены.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    if (text === '📊 Отчёт за дату') {
      const today = new Date().toISOString().slice(0, 10);
      const data = await getDailySalesByDate(today);

      if (!data) {
        await sendMessage(chatId, `❌ Нет данных за ${today}`, mainKeyboard());
        return res.sendStatus(200);
      }

      const message =
        `📊 <b>Отчёт за ${today}</b>\n\n` +
        `🏦 Banks 1: <b>${data.banks_1} €</b>\n` +
        `🏦 Banks 2: <b>${data.banks_2} €</b>\n` +
        `💳 Card: <b>${data.card} €</b>\n` +
        `🅿️ PayPal: <b>${data.paypal} €</b>\n` +
        `🔁 Transfer: <b>${data.transfer} €</b>\n\n` +
        `💰 <b>Итого:</b> ${data.total_sales} €\n` +
        `📦 Заказов: ${data.orders_count}`;

      await sendMessage(chatId, message, mainKeyboard());
      return res.sendStatus(200);
    }

    if (text.toLowerCase().includes('помощ')) {
      await sendMessage(
        chatId,
        'ℹ️ <b>Помощь</b>\n\n' +
        '📊 Отчёт за дату — считает из Google Sheets\n' +
        'Следующие команды подключим дальше.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard());
    res.sendStatus(200);

  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

// ================== HEALTH CHECK ==================
app.get('/', (_, res) => {
  res.send('✅ Molecule webhook is running');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
