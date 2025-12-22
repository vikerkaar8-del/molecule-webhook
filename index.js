/****************************************************
 * Aromat CashFlow Bot — RENDER WEBHOOK (STABLE)
 ****************************************************/

import express from 'express';

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const PORT = process.env.PORT || 3000;

// Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979', '499185572'];

// ================== HELPERS ==================
async function telegram(method, payload) {
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
    if (!msg) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = (msg.text || '').trim();

    if (!isAllowed(userId)) {
      await sendMessage(chatId, '⛔ Нет доступа');
      return res.sendStatus(200);
    }

    if (text === '/start') {
      await sendMessage(
        chatId,
        '✅ <b>Aromat CashFlow</b>\n\n' +
        'Бот работает через <b>Render webhook</b>.\n' +
        'Дальше подключим расчёты.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    if (text.toLowerCase().includes('помощ')) {
      await sendMessage(
        chatId,
        'ℹ️ <b>Помощь</b>\n\n' +
        'Сейчас активен webhook.\n' +
        'Следующий шаг — Google Sheets.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Выбери команду 👇', mainKeyboard());
    res.sendStatus(200);

  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

// ================== HEALTH CHECK ==================
app.get('/', (_, res) => {
  res.send('✅ Molecule webhook is running');
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
