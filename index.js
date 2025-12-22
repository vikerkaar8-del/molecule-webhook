import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// ======================
// ENV
// ======================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL        = process.env.GAS_URL;

if (!TELEGRAM_TOKEN || !GAS_URL) {
  console.error('❌ ENV variables TELEGRAM_TOKEN or GAS_URL are missing');
  process.exit(1);
}

// ======================
// Telegram helper
// ======================
async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (keyboard) payload.reply_markup = keyboard;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ======================
// Keyboard
// ======================
const mainKeyboard = {
  keyboard: [
    [{ text: '📊 Отчёт за дату' }, { text: '📅 Период (отчёт)' }],
    [{ text: '💰 Поступления на дату' }],
    [{ text: 'ℹ️ Помощь' }],
  ],
  resize_keyboard: true,
};

// ======================
// Call GAS
// ======================
async function callGAS(payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ======================
// STATE (in-memory, ok for reports)
// ======================
const userState = {};

// ======================
// WEBHOOK
// ======================
app.post('/telegram', async (req, res) => {
  res.send('OK');

  const msg = req.body.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  console.log('📩', chatId, text);

  // /start
  if (text === '/start') {
    userState[chatId] = null;
    await sendMessage(
      chatId,
      '✅ <b>Aromat CashFlow</b>\n\nБот работает через <b>Node.js + Google Apps Script</b>.\nВыбери команду 👇',
      mainKeyboard
    );
    return;
  }

  // Buttons
  if (text.includes('Отчёт за дату')) {
    userState[chatId] = 'WAIT_REPORT_DAY';
    await sendMessage(chatId, 'Введите дату: <code>YYYY-MM-DD</code>');
    return;
  }

  if (text.includes('Период')) {
    userState[chatId] = 'WAIT_REPORT_RANGE';
    await sendMessage(chatId, 'Введите период:\n<code>YYYY-MM-DD YYYY-MM-DD</code>');
    return;
  }

  if (text.includes('Поступления')) {
    userState[chatId] = 'WAIT_PAYOUT_DAY';
    await sendMessage(chatId, 'Введите дату поступлений: <code>YYYY-MM-DD</code>');
    return;
  }

  if (text.includes('Помощь')) {
    await sendMessage(
      chatId,
      'ℹ️ <b>Команды</b>\n\n' +
      '📊 Отчёт за дату — продажи за день\n' +
      '📅 Период — отчёт за период\n' +
      '💰 Поступления — выплаты по дате'
    );
    return;
  }

  // ======================
  // DATE INPUT
  // ======================
  const state = userState[chatId];

  try {
    if (state === 'WAIT_REPORT_DAY') {
      userState[chatId] = null;
      const r = await callGAS({ action: 'report_day', date: text });
      await sendMessage(chatId, r.text, mainKeyboard);
      return;
    }

    if (state === 'WAIT_PAYOUT_DAY') {
      userState[chatId] = null;
      const r = await callGAS({ action: 'payout_day', date: text });
      await sendMessage(chatId, r.text, mainKeyboard);
      return;
    }

    if (state === 'WAIT_REPORT_RANGE') {
      userState[chatId] = null;
      const [from, to] = text.split(' ');
      const r = await callGAS({ action: 'report_range', from, to });
      await sendMessage(chatId, r.text, mainKeyboard);
      return;
    }

  } catch (e) {
    console.error(e);
    await sendMessage(chatId, '❌ Ошибка обработки данных');
  }

  await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard);
});

// ======================
// HEALTH
// ======================
app.get('/', (_, res) => res.send('OK'));

// ======================
// START
// ======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
