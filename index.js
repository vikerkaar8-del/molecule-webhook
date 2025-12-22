/****************************************************
 * Aromat CashFlow Bot — Render + Google Sheets
 ****************************************************/

import express from 'express';
import fetch from 'node-fetch';
import { google } from 'googleapis';

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979', '499185572'];

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'DailySales';

// ================== GOOGLE AUTH ==================
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.JWT(
  serviceAccount.client_email,
  null,
  serviceAccount.private_key,
  ['https://www.googleapis.com/auth/spreadsheets.readonly']
);

const sheets = google.sheets({ version: 'v4', auth });

// ================== TELEGRAM ==================
async function telegram(method, payload) {
  await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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
      [{ text: '📊 Отчёт за дату' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

function isAllowed(userId) {
  return ALLOWED_USERS.includes(String(userId));
}

// ================== GOOGLE READ ==================
async function getDailyReport(date) {
  const range = `${SHEET_NAME}!A:H`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return null;

  const header = rows[0];
  const data = rows.slice(1);

  const row = data.find(r => r[0] === date);
  if (!row) return null;

  const map = Object.fromEntries(header.map((h, i) => [h, row[i] || '0']));
  return map;
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
        '✅ <b>Aromat CashFlow</b>\nБот подключён к Google Sheets.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    if (text === '📊 Отчёт за дату') {
      await sendMessage(chatId, 'Введи дату в формате:\n<code>YYYY-MM-DD</code>');
      return res.sendStatus(200);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const report = await getDailyReport(text);
      if (!report) {
        await sendMessage(chatId, '❌ Нет данных за эту дату');
        return res.sendStatus(200);
      }

      const message =
        `📊 <b>Отчёт за ${text}</b>\n\n` +
        `🏦 Банк 1: ${report.banks_1} €\n` +
        `🏦 Банк 2: ${report.banks_2} €\n` +
        `💳 Карта: ${report.card} €\n` +
        `🅿️ PayPal: ${report.paypal} €\n` +
        `🏛 Перевод: ${report.transfer} €\n\n` +
        `💰 <b>Итого: ${report.total_sales} €</b>\n` +
        `📦 Заказов: ${report.orders_count}`;

      await sendMessage(chatId, message, mainKeyboard());
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard());
    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

// ================== HEALTH ==================
app.get('/', (_, res) => {
  res.send('✅ Molecule webhook is running');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
