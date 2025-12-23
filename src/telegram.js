import fetch from 'node-fetch';

const TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = `https://api.telegram.org/bot${TOKEN}`;

export async function sendMessage(chatId, text) {
  await fetch(`${API_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}
