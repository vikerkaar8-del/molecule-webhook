export const PORT = process.env.PORT || 10000;

export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN is missing');
}

export const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export const ALLOWED_USERS = [
  '1356353979',
  '499185572'
];
