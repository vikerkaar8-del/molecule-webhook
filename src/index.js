import express from 'express';
import { sendMessage } from './telegram.js';
import { askGPT } from './gpt.js';

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message?.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const reply = await askGPT(userText);
    await sendMessage(chatId, reply);
  } catch (e) {
    console.error(e);
    await sendMessage(chatId, 'Что-то пошло не так 🙏 Сейчас уточню и помогу.');
  }

  res.sendStatus(200);
});

app.get('/', (_, res) => {
  res.send('Molecule Assistant is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Bot started on port', PORT);
});
