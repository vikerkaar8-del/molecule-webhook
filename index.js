/****************************************************
 * Aromat CashFlow — Render Webhook (HYBRID)
 * Node.js = UX + menu + state
 * Google Apps Script = calculations
 ****************************************************/

import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

/* ================== CONFIG ================== */
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = process.env.GAS_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979', '499185572'];

/* ================== STATE ================== */
const userState = new Map(); 
// chatId => { mode: 'WAIT_DATE_REPORT' | 'WAIT_DATE_RECALC' }

/* ================== HELPERS ================== */
async function tg(method, payload) {
  await fetch(`${TELEGRAM_API}/${method}`, {
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
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function isAllowed(id) {
  return ALLOWED_USERS.includes(String(id));
}

function isDate(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text);
}

/* ================== GOOGLE APPS SCRIPT ================== */
async function callGAS(action, payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  return res.json();
}

/* ================== WEBHOOK ================== */
app.post('/telegram', async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || '').trim();

  if (!isAllowed(userId)) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '⛔ Нет доступа'
    });
    return res.sendStatus(200);
  }

  /* ===== /start ===== */
  if (text === '/start') {
    userState.delete(chatId);
    await tg('sendMessage', {
      chat_id: chatId,
      text:
        '✅ <b>Aromat CashFlow</b>\n\n' +
        'Бот работает через Render + Google Sheets.\n' +
        'Выбери команду 👇',
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return res.sendStatus(200);
  }

  /* ===== HELP ===== */
  if (text.includes('Помощ')) {
    await tg('sendMessage', {
      chat_id: chatId,
      text:
        'ℹ️ <b>Команды</b>\n\n' +
        '📊 Отчёт за дату — продажи за день\n' +
        '💰 Поступления — выплаты по PayoutPlan\n' +
        '🔄 Пересчитать день — пересобрать данные\n\n' +
        'После команды просто введи дату: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML',
      reply_markup: keyboard()
    });
    return res.sendStatus(200);
  }

  /* ===== MENU COMMANDS ===== */
  if (text === '📊 Отчёт за дату') {
    userState.set(chatId, { mode: 'WAIT_REPORT_DATE' });
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Введите дату: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML'
    });
    return res.sendStatus(200);
  }

  if (text === '💰 Поступления на дату') {
    userState.set(chatId, { mode: 'WAIT_PAYOUT_DATE' });
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Введите дату поступлений: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML'
    });
    return res.sendStatus(200);
  }

  if (text === '🔄 Пересчитать день') {
    userState.set(chatId, { mode: 'WAIT_RECALC_DATE' });
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Введите дату для пересчёта: <code>YYYY-MM-DD</code>',
      parse_mode: 'HTML'
    });
    return res.sendStatus(200);
  }

  /* ===== DATE INPUT ===== */
  const state = userState.get(chatId);

  if (state && isDate(text)) {
    userState.delete(chatId);

    if (state.mode === 'WAIT_REPORT_DATE') {
      const data = await callGAS('dailyReport', { date: text });
      await tg('sendMessage', {
        chat_id: chatId,
        text: data.text,
        parse_mode: 'HTML',
        reply_markup: keyboard()
      });
      return res.sendStatus(200);
    }

    if (state.mode === 'WAIT_PAYOUT_DATE') {
      const data = await callGAS('payoutReport', { date: text });
      await tg('sendMessage', {
        chat_id: chatId,
        text: data.text,
        parse_mode: 'HTML',
        reply_markup: keyboard()
      });
      return res.sendStatus(200);
    }

    if (state.mode === 'WAIT_RECALC_DATE') {
      await callGAS('recalcDay', { date: text });
      await tg('sendMessage', {
        chat_id: chatId,
        text: `✅ Пересчитано: <b>${text}</b>`,
        parse_mode: 'HTML',
        reply_markup: keyboard()
      });
      return res.sendStatus(200);
    }
  }

  /* ===== FALLBACK ===== */
  await tg('sendMessage', {
    chat_id: chatId,
    text: 'Выбери команду 👇',
    reply_markup: keyboard()
  });

  res.sendStatus(200);
});

/* ================== HEALTH ================== */
app.get('/', (_, res) => {
  res.send('✅ Aromat CashFlow webhook is running');
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
