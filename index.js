/****************************************************
 * Aromat CashFlow Bot — WEBHOOK VERSION (Node.js)
 * Replaces Google Apps Script polling
 * Logic preserved 1:1
 ****************************************************/

import express from 'express';
import fetch from 'node-fetch';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// ================== CONFIG ==================
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TZ = 'Europe/Tallinn';

// Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const TELEGRAM_CHAT_ID = '1356353979';
const ALLOWED_USERS = ['1356353979', '499185572'];

// InSales
const INS_API_KEY = process.env.INS_API_KEY;
const INS_PASSWORD = process.env.INS_PASSWORD;
const INS_DOMAIN = 'aromat.ee';
const INS_PER_PAGE = 50;

// ================== STATE (замена PropertiesService) ==================
const chatModes = new Map();      // chatId → mode
let recalcJob = null;             // single background job

// ================== TELEGRAM ==================
async function telegram(method, payload) {
  await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function sendTelegram(chatId, text, keyboard = null) {
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
      [{ text: '📊 Отчёт за дату' }, { text: '📅 Период (отчёт)' }],
      [{ text: '💰 Поступления на дату' }, { text: '🔄 Пересчитать день' }],
      [{ text: '🔁 Пересчитать период' }, { text: '🧹 Очистить период' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  };
}

function isAllowed(userId) {
  return ALLOWED_USERS.includes(String(userId));
}

// ================== WEBHOOK ==================
app.post('/telegram', async (req, res) => {
  try {
    const msg = req.body.message;
    if (msg) await handleMessage(msg);
    res.sendStatus(200);
  } catch (e) {
    console.error('Webhook error:', e);
    res.sendStatus(200);
  }
});

app.get('/', (_, res) => {
  res.send('✅ Molecule webhook is running');
});

// ================== MESSAGE HANDLER ==================
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const textRaw = (msg.text || '').trim();

  if (!isAllowed(userId)) {
    await sendTelegram(chatId, '⛔ Нет доступа', mainKeyboard());
    return;
  }

  const text = normalizeCmd(textRaw);
  const mode = chatModes.get(chatId);

  if (text === '/start') {
    await sendTelegram(
      chatId,
      '✅ <b>Aromat CashFlow</b>\n\nСчитаем только <b>paid</b> заказы.',
      mainKeyboard()
    );
    return;
  }

  if (text === 'help') {
    await sendTelegram(chatId, buildHelpMessage(), mainKeyboard());
    return;
  }

  if (text === 'report') {
    chatModes.set(chatId, 'WAIT_REPORT_DATE');
    await sendTelegram(chatId, 'Введи дату: <code>YYYY-MM-DD</code>', mainKeyboard());
    return;
  }

  if (mode === 'WAIT_REPORT_DATE') {
    chatModes.delete(chatId);
    const d = parseDate(textRaw);
    if (!d) {
      await sendTelegram(chatId, '❌ Неверная дата', mainKeyboard());
      return;
    }
    await sendTelegram(chatId, buildDailyReportStub(d), mainKeyboard());
    return;
  }

  await sendTelegram(chatId, 'Выбери команду 👇', mainKeyboard());
}

// ================== COMMAND NORMALIZER ==================
function normalizeCmd(t) {
  const x = t.toLowerCase();
  if (x.includes('отч') && x.includes('дат')) return 'report';
  if (x.includes('период')) return 'range';
  if (x.includes('поступ')) return 'payout';
  if (x.includes('пересчит') && x.includes('период')) return 'recalc_range';
  if (x.includes('пересчит')) return 'recalc';
  if (x.includes('очист')) return 'clear_range';
  if (x.includes('помощ')) return 'help';
  if (x === '/start') return '/start';
  return x;
}

// ================== HELP ==================
function buildHelpMessage() {
  return (
    'ℹ️ <b>Помощь</b>\n\n' +
    '• 📊 Отчёт за дату\n' +
    '• 📅 Отчёт за период\n' +
    '• 💰 Поступления на дату\n' +
    '• 🔄 Пересчитать день\n' +
    '• 🔁 Пересчитать период\n' +
    '• 🧹 Очистить период\n\n' +
    '⚠️ Считаем только <b>paid</b> заказы'
  );
}

// ================== DATE UTILS ==================
function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return dayjs.tz(s, TZ).toDate();
}

function fmtDate(d) {
  return dayjs(d).tz(TZ).format('YYYY-MM-DD');
}

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addBusinessDays(date, days) {
  let d = dayjs(date);
  let added = 0;
  while (added < days) {
    d = d.add(1, 'day');
    if (!isWeekend(d.toDate())) added++;
  }
  return d.toDate();
}

// ================== REPORT STUB (дальше подключим Sheets) ==================
function buildDailyReportStub(dateObj) {
  const d = fmtDate(dateObj);
  return (
    `📊 <b>Отчёт за ${d}</b>\n\n` +
    `⚠️ Сейчас это заглушка.\n` +
    `Следующий шаг — подключение Google Sheets API.`
  );
}

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log('Server started on port', PORT);
});
