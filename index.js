import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import { google } from 'googleapis';

// ================== CONFIG ==================
const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const SHEET_DAILY_SALES = 'DailySales';

// Google service account
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// ================== APP ==================
const app = express();
app.use(bodyParser.json());

// ================== TELEGRAM ==================
async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: keyboard
  };

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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

// ================== GOOGLE SHEETS ==================
async function getDailyReport(dateStr) {
  const range = `${SHEET_DAILY_SALES}!A2:I`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const rows = res.data.values || [];
  const row = rows.find(r => r[0] === dateStr);
  if (!row) return null;

  return {
    date: row[0],
    banks1: row[1] || 0,
    banks2: row[2] || 0,
    card: row[3] || 0,
    paypal: row[4] || 0,
    transfer: row[5] || 0,
    total: row[6] || 0,
    orders: row[7] || 0
  };
}

// ⚠️ Заглушка пересчёта (у тебя InSales логика уже есть)
// Здесь просто подтверждаем пересчёт
async function recalcDay(dateStr) {
  // тут ты можешь вставить свою реальную логику InSales
  return true;
}

// ================== WEBHOOK ==================
app.post('/telegram', async (req, res) => {
  try {
    const msg = req.body.message;
    if (!msg) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    // /start
    if (text === '/start') {
      await sendMessage(
        chatId,
        '✅ <b>Aromat CashFlow</b>\nGoogle Sheets подключены.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    // HELP
    if (text.includes('Помощ')) {
      await sendMessage(
        chatId,
        '📊 Отчёт — читает данные из DailySales\n🔄 Пересчитать день — обновляет данные',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    // REPORT BUTTON
    if (text.includes('Отчёт')) {
      await sendMessage(chatId, 'Введите дату: <code>YYYY-MM-DD</code>', mainKeyboard());
      return res.sendStatus(200);
    }

    // RECALC BUTTON
    if (text.includes('Пересчитать')) {
      await sendMessage(chatId, 'Введите дату: <code>YYYY-MM-DD</code>', mainKeyboard());
      return res.sendStatus(200);
    }

    // DATE INPUT
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      // 1) Пересчёт
      if (msg.reply_to_message?.text?.includes('Пересчитать') || false) {
        await recalcDay(text);
        await sendMessage(chatId, `✅ Пересчитано: <b>${text}</b>`, mainKeyboard());
        return res.sendStatus(200);
      }

      // 2) Отчёт
      const report = await getDailyReport(text);
      if (!report) {
        await sendMessage(chatId, `❌ Нет данных за ${text}`, mainKeyboard());
        return res.sendStatus(200);
      }

      const msgText =
        `📊 <b>Отчёт за ${text}</b>\n` +
        `Заказов: <b>${report.orders}</b>\n\n` +
        `🏦 Банки 1: <b>${report.banks1} €</b>\n` +
        `🏦 Банки 2: <b>${report.banks2} €</b>\n` +
        `💳 Карта: <b>${report.card} €</b>\n` +
        `🅿️ PayPal: <b>${report.paypal} €</b>\n` +
        `🏛 Перевод: <b>${report.transfer} €</b>\n\n` +
        `💶 <b>Итого: ${report.total} €</b>`;

      await sendMessage(chatId, msgText, mainKeyboard());
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard());
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// ================== SERVER ==================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
