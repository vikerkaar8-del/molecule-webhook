import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TG_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

async function tg(method, payload) {
  return fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

app.post('/telegram', async (req, res) => {
  try {
    const msg = req.body.message;
    if (!msg) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (text === '/start') {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '✅ Aromat CashFlow — бот подключён.',
      });
      return res.sendStatus(200);
    }

    // Пересчитать день
    if (text.includes('Пересчитать день')) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Введите дату: YYYY-MM-DD'
      });
      return res.sendStatus(200);
    }

    // Отчёт
    if (text.includes('Отчёт за дату')) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Введите дату: YYYY-MM-DD'
      });
      return res.sendStatus(200);
    }

    // если введена дата
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const date = text;

      // вызываем Apps Script → recalc
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'recalcDay',
          date
        })
      });

      // после пересчёта делаем отчёт
      const r = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'reportDay',
          date
        })
      });

      const data = await r.json();

      await tg('sendMessage', {
        chat_id: chatId,
        text: data.text || `❌ Ошибка.`,
      });

      return res.sendStatus(200);
    }

    // default
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Выбери команду 👇',
    });

    res.sendStatus(200);

  } catch (e) {
    console.error(e);
    res.sendStatus(200);
  }
});

app.get('/', (_, res) => res.send('OK'));
app.listen(PORT, () => console.log("Server started on port", PORT));
