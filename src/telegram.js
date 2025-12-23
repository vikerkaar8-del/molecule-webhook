import fetch from 'node-fetch';
import { TELEGRAM_API } from './config.js';

export async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  };

  if (keyboard) payload.reply_markup = keyboard;

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return res.json();
}

export function mainKeyboard() {
  return {
    keyboard: [
      [{ text: '🚚 Доставка' }, { text: '💳 Оплата' }],
      [{ text: '🧪 Распив' }, { text: '🎁 Подарки' }],
      [{ text: '👩‍💻 Связаться' }]
    ],
    resize_keyboard: true
  };
}
