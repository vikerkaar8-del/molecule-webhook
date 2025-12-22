import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979', '499185572'];

// ================== STATE ==================
const userState = {}; // chatId -> { mode }

// ================== HELPERS ==================
async function tg(method, payload) {
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
  await tg('sendMessage', payload);
}

function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Отчёт за дату' }, { text: '📅 Период (отчёт)' }],
      [{ text: '💰 Поступления на дату' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

function isAllowed(userId) {
  return ALLOWED_USERS.includes(String(userId));
}

async function callGAS(payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
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

    userState[chatId] ||= {};

    // ---------- START ----------
    if (text === '/start') {
      await sendMessage(
        chatId,
        '✅ <b>Aromat CashFlow</b>\n\n' +
        'Бот работает через Node.js + Google Apps Script.\n' +
        'Выбери действие:',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    // ---------- HELP ----------
    if (text.toLowerCase().includes('помощ')) {
      await sendMessage(
        chatId,
        'ℹ️ <b>Помощь</b>\n\n' +
        '• 📊 Отчёт за дату — продажи за день\n' +
        '• 📅 Период — отчёт за период\n' +
        '• 💰 Поступления — выплаты на дату\n\n' +
        'Формат дат: <code>YYYY-MM-DD</code>',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    // ---------- COMMANDS ----------
    if (text.includes('Отчёт за дату')) {
      userState[chatId].mode = 'REPORT_DAY';
      await sendMessage(chatId, 'Введите дату: <code>YYYY-MM-DD</code>');
      return res.sendStatus(200);
    }

    if (text.includes('Период')) {
      userState[chatId].mode = 'REPORT_RANGE';
      await sendMessage(chatId, 'Введите период:\n<code>YYYY-MM-DD YYYY-MM-DD</code>');
      return res.sendStatus(200);
    }

    if (text.includes('Поступления')) {
      userState[chatId].mode = 'PAYOUT_DAY';
      await sendMessage(chatId, 'Введите дату поступлений:\n<code>YYYY-MM-DD</code>');
      return res.sendStatus(200);
    }

    // ---------- STATE HANDLING ----------
    const mode = userState[chatId].mode;

    if (mode === 'REPORT_DAY') {
      userState[chatId].mode = null;
      const r = await callGAS({ action: 'report_day', date: text });
      await sendMessage(chatId, r.text || '❌ Ошибка');
      return res.sendStatus(200);
    }

    if (mode === 'REPORT_RANGE') {
      userState[chatId].mode = null;
      const [from, to] = text.split(' ');
      const r = await callGAS({ action: 'report_range', from, to });
      await sendMessage(chatId, r.text || '❌ Ошибка');
      return res.sendStatus(200);
    }

    if (mode === 'PAYOUT_DAY') {
      userState[chatId].mode = null;
      const r = await callGAS({ action: 'payout_day', date: text });
      await sendMessage(chatId, r.text || '❌ Ошибка');
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Выберите команду 👇', mainKeyboard());
    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

// ================== HEALTH ==================
app.get('/', (_, res) => {
  res.send('✅ Telegram bot is running');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
