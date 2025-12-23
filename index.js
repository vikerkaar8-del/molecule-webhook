import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TG_TOKEN = process.env.TG_TOKEN;

// 🔹 health check
app.get('/', (req, res) => {
  res.send('Aromat Bot OK');
});

// 🔹 Telegram webhook
app.post('/telegram', async (req, res) => {
  // ⚠️ ВАЖНО: ответить СРАЗУ
  res.send('OK');

  const msg = req.body.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text || '';

  await sendTelegram(chatId, `🤔 Думаю…\nТы написал: <b>${text}</b>`);
});

// 🔹 send message
async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });
}

app.listen(PORT, () => {
  console.log('Bot started on port', PORT);
});
