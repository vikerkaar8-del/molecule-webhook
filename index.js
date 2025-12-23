import express from 'express';
import { PORT, ALLOWED_USERS } from './config.js';
import { sendMessage, mainKeyboard } from './telegram.js';

const app = express();
app.use(express.json());

// healthcheck
app.get('/', (_, res) => {
  res.send('✅ Molecule bot is alive');
});

// webhook
app.post('/telegram', async (req, res) => {
  try {
    const msg = req.body.message;
    if (!msg) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = (msg.text || '').trim();

    console.log('📩 UPDATE:', JSON.stringify(msg));

    if (!ALLOWED_USERS.includes(userId)) {
      await sendMessage(chatId, '⛔ Нет доступа');
      return res.sendStatus(200);
    }

    if (text === '/start') {
      await sendMessage(
        chatId,
        '👋 Привет! Я помощник Molecule.ee.\nВыбери раздел или задай вопрос.',
        mainKeyboard()
      );
      return res.sendStatus(200);
    }

    await sendMessage(chatId, 'Напиши /start чтобы начать', mainKeyboard());
    res.sendStatus(200);

  } catch (e) {
    console.error('❌ Webhook error:', e);
    res.sendStatus(200);
  }
});

app.listen(PORT, () => {
  console.log('🚀 Bot listening on port', PORT);
});
