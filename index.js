import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

/* ================== НАСТРОЙКИ ================== */

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL; 
// пример: https://script.google.com/macros/s/XXXXX/exec

const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

/* ================== HELPERS ================== */

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function tgSend(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  };
  if (keyboard) body.reply_markup = keyboard;

  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт сегодня' }, { text: '📊 Отчёт вчера' }],
      [{ text: '💰 Поступления сегодня' }, { text: '💰 Поступления завтра' }],
      [{ text: '📅 Отчёт за 7 дней' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

async function gas(action, payload = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  const json = await res.json();
  return json.text || '❌ Нет ответа от GAS';
}

/* ================== WEBHOOK ================== */

app.post('/telegram', async (req, res) => {
  try {
    const msg = req.body.message;
    if (!msg || !msg.text) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const text = msg.text;

    // START
    if (text === '/start') {
      await tgSend(
        chatId,
        '✅ <b>Aromat CashFlow</b>\n\nВыбери команду 👇',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    // 📊 Сегодня
    if (text.includes('Отчёт сегодня')) {
      const d = today(0);
      const reply = await gas('report_day', { date: d });
      await tgSend(chatId, reply, mainKeyboard());
    }

    // 📊 Вчера
    else if (text.includes('Отчёт вчера')) {
      const d = today(-1);
      const reply = await gas('report_day', { date: d });
      await tgSend(chatId, reply, mainKeyboard());
    }

    // 💰 Сегодня
    else if (text.includes('Поступления сегодня')) {
      const d = today(0);
      const reply = await gas('payout_day', { date: d });
      await tgSend(chatId, reply, mainKeyboard());
    }

    // 💰 Завтра
    else if (text.includes('Поступления завтра')) {
      const d = today(1);
      const reply = await gas('payout_day', { date: d });
      await tgSend(chatId, reply, mainKeyboard());
    }

    // 📅 7 дней
    else if (text.includes('7 дней')) {
      const to = today(0);
      const from = today(-6);
      const reply = await gas('report_range', { from, to });
      await tgSend(chatId, reply, mainKeyboard());
    }

    // ℹ️ HELP
    else if (text.includes('Помощ')) {
      await tgSend(
        chatId,
        'ℹ️ <b>Команды</b>\n\n' +
        '📊 Отчёты — продажи\n' +
        '💰 Поступления — выплаты\n\n' +
        'Данные берутся из Google Sheets',
        mainKeyboard()
      );
    }

    else {
      await tgSend(chatId, 'Выбери команду 👇', mainKeyboard());
    }

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(200);
  }
});

/* ================== START ================== */

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('🚀 Bot started on', PORT);
});
