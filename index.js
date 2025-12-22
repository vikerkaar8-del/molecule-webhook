/****************************************************
 * Aromat CashFlow Bot — Render + Google Sheets
 * READ ONLY (DailySales)
 ****************************************************/

import express from 'express';
import fetch from 'node-fetch';
import { google } from 'googleapis';

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const PORT = process.env.PORT || 10000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DAILY_SHEET = 'DailySales';

const ALLOWED_USERS = ['1356353979', '499185572'];

// ================== GOOGLE AUTH ==================
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ================== HELPERS ==================
async function telegram(method, payload) {
  return fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function isAllowed(id) {
  return ALLOWED_USERS.includes(String(id));
}

async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (keyboard) payload.reply_markup = keyboard;
  await telegram('sendMessage', payload);
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт за дату' }],
    ],
    resize_keyboard: true,
  };
}

// ================== GOOGLE SHEETS ==================
async function getDailyRow(dateStr) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DAILY_SHEET}!A2:H`,
  });

  const rows = res.data.values || [];
  return rows.find(r => r[0] === dateStr);
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

    if (text.includes('Отчёт')) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const dateStr = today.toISOString().slice(0,10);

      const row = await getDailyRow(dateStr);

      if (!row) {
        await sendMessage(chatId, `❌ Нет данных за ${dateStr}`);
        return res.sendStatus(200);
      }

      const msgText =
        `📊 <b>Отчёт за ${dateStr}</b>\n\n` +
        `🏦 Банки 1: <b>${row[1]} €</b>\n` +
        `🏦 Банки 2: <b>${row[2]} €</b>\n` +
        `💳 Карта: <b>${row[3]} €</b>\n` +
        `🅿️ PayPal: <b>${row[4]} €</b>\n` +
        `🏛 Перевод: <b>${row[5]} €</b>\n\n` +
        `💶 <b>Итого: ${row[6]} €</b>\n` +
        `📦 Заказов: <b>${row[7]}</b>`;

      await sendMessage(chatId, msgText, mainKeyboard());
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
  res.send('✅ Aromat CashFlow webhook running');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
