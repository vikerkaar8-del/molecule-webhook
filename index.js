import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL;

const TG_API = `https://api.telegram.org/bot${TOKEN}`;
const userState = new Map();

/* ---------- helpers ---------- */

async function tg(method, payload) {
  await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function keyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт за дату' }, { text: '💰 Поступления на дату' }],
      [{ text: '🔄 Пересчитать день' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

async function callGAS(body) {
  const r = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/* ---------- webhook ---------- */

app.post('/webhook', async (req, res) => {
  res.send('OK');

  const msg = req.body.message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  /* ----- START ----- */
  if (text === '/start') {
    userState.delete(chatId);
    await tg('sendMessage', {
      chat_id: chatId,
      text: '✅ <b>Aromat CashFlow</b>\nВыбери команду 👇',
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return;
  }

  /* ----- BUTTONS ----- */
  if (text.includes('Отчёт за дату')) {
    userState.set(chatId, { mode: 'REPORT_DAY' });
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Введите дату: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML'
    });
    return;
  }

  if (text.includes('Пересчитать день')) {
    userState.set(chatId, { mode: 'RECALC_DAY' });
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Введите дату для пересчёта: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML'
    });
    return;
  }

  if (text.includes('Поступления')) {
    userState.set(chatId, { mode: 'PAYOUT_DAY' });
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Введите дату поступлений: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML'
    });
    return;
  }

  if (text.includes('Помощ')) {
    await tg('sendMessage', {
      chat_id: chatId,
      text:
        'ℹ️ <b>Помощь</b>\n\n' +
        '• 📊 Отчёт за дату — данные из DailySales\n' +
        '• 🔄 Пересчитать день — пересбор данных\n' +
        '• 💰 Поступления — из PayoutPlan',
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return;
  }

  /* ----- DATE INPUT ----- */
  const state = userState.get(chatId);
  if (!state) return;

  if (!isDate(text)) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '❌ Неверный формат даты. Пример: <code>2025-12-22</code>',
      parse_mode: 'HTML'
    });
    return;
  }

  userState.delete(chatId);

  /* ----- ACTIONS ----- */

  if (state.mode === 'RECALC_DAY') {
    const r = await callGAS({ action: 'recalc_day', date: text });
    await tg('sendMessage', {
      chat_id: chatId,
      text: r.text,
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return;
  }

  if (state.mode === 'REPORT_DAY') {
    const r = await callGAS({ action: 'report_day', date: text });
    await tg('sendMessage', {
      chat_id: chatId,
      text: r.text,
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return;
  }

  if (state.mode === 'PAYOUT_DAY') {
    const r = await callGAS({ action: 'payout_day', date: text });
    await tg('sendMessage', {
      chat_id: chatId,
      text: r.text,
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return;
  }
});

/* ---------- server ---------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 Bot started on', PORT));
