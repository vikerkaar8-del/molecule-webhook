import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// ================== НАСТРОЙКИ ==================
const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN; // TELEGRAM TOKEN
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzH8rDFuECt4Bx3JjvAp15lVUZu5nZdv79y-FWUNSZwcLxMVv8uSk4BqxvVzb0hATROiA/exec';

// Telegram API
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ================== ВСПОМОГАТЕЛЬНЫЕ ==================
async function sendMessage(chatId, text) {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function callGAS(payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.text);
  return json.text;
}

// ================== TELEGRAM WEBHOOK ==================
app.post('/telegram', async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // ---------- START ----------
    if (text === '/start') {
      await sendMessage(
        chatId,
        '✅ <b>Aromat CashFlow</b>\n\n' +
        '📊 /today — отчёт сегодня\n' +
        '📊 /yesterday — отчёт вчера\n' +
        '📅 /week — отчёт за 7 дней\n\n' +
        '💰 /payout — поступления сегодня\n' +
        '💰 /payout_tomorrow — поступления завтра'
      );
      return;
    }

    // ---------- ОТЧЁТ СЕГОДНЯ ----------
    if (text === '/today') {
      const report = await callGAS({
        action: 'report_day',
        date: today()
      });
      await sendMessage(chatId, report);
      return;
    }

    // ---------- ОТЧЁТ ВЧЕРА ----------
    if (text === '/yesterday') {
      const report = await callGAS({
        action: 'report_day',
        date: yesterday()
      });
      await sendMessage(chatId, report);
      return;
    }

    // ---------- ОТЧЁТ ЗА 7 ДНЕЙ ----------
    if (text === '/week') {
      const to = today();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 6);
      const from = fromDate.toISOString().slice(0, 10);

      const report = await callGAS({
        action: 'report_range',
        from,
        to
      });
      await sendMessage(chatId, report);
      return;
    }

    // ---------- ПОСТУПЛЕНИЯ СЕГОДНЯ ----------
    if (text === '/payout') {
      const report = await callGAS({
        action: 'payout_day',
        date: today()
      });
      await sendMessage(chatId, report);
      return;
    }

    // ---------- ПОСТУПЛЕНИЯ ЗАВТРА ----------
    if (text === '/payout_tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const date = d.toISOString().slice(0, 10);

      const report = await callGAS({
        action: 'payout_day',
        date
      });
      await sendMessage(chatId, report);
      return;
    }

    // ---------- НЕИЗВЕСТНО ----------
    await sendMessage(chatId, '❓ Неизвестная команда. Введи /start');

  } catch (err) {
    console.error(err);
  }
});

// ================== HEALTH CHECK ==================
app.get('/', (req, res) => {
  res.send('Aromat CashFlow bot is running');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Bot started on port ${PORT}`);
});
