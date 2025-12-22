import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// =======================
// НАСТРОЙКИ
// =======================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL; 
// пример:
// https://script.google.com/macros/s/AKfycbxxxx/exec

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// =======================
// TELEGRAM HELPERS
// =======================

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });
}

async function callGAS(action) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  const json = await res.json();
  return json.text || '⚠️ Нет данных';
}

// =======================
// WEBHOOK
// =======================

app.post('/telegram', async (req, res) => {
  res.sendStatus(200); // ⚠️ сразу отвечаем Telegram

  try {
    const msg = req.body.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();

    // ---------- команды ----------
    if (text === '/start') {
      await sendMessage(
        chatId,
        `✅ <b>Aromat CashFlow</b>

Доступные команды:
/today — отчёт за сегодня
/yesterday — отчёт за вчера
/week — отчёт за 7 дней
/payout — поступления сегодня
/payout_tomorrow — поступления завтра`
      );
      return;
    }

    if (text === '/today') {
      const t = await callGAS('report_today');
      await sendMessage(chatId, t);
      return;
    }

    if (text === '/yesterday') {
      const t = await callGAS('report_yesterday');
      await sendMessage(chatId, t);
      return;
    }

    if (text === '/week') {
      const t = await callGAS('report_range_7');
      await sendMessage(chatId, t);
      return;
    }

    if (text === '/payout') {
      const t = await callGAS('payout_today');
      await sendMessage(chatId, t);
      return;
    }

    if (text === '/payout_tomorrow') {
      const t = await callGAS('payout_tomorrow');
      await sendMessage(chatId, t);
      return;
    }

    await sendMessage(chatId, '❓ Неизвестная команда. Введи /start');

  } catch (e) {
    console.error('Telegram error:', e);
  }
});

// =======================
// SERVER
// =======================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
