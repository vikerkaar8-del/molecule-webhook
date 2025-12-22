import express from 'express';
import fetch from 'node-fetch';
import { google } from 'googleapis';

/* ================== CONFIG ================== */
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TZ = 'Europe/Tallinn';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979', '499185572'];

const INS_API_KEY = process.env.INS_API_KEY;
const INS_PASSWORD = process.env.INS_PASSWORD;
const INS_DOMAIN = 'aromat.ee';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

/* ================== GOOGLE ================== */
const auth = new google.auth.JWT({
  email: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email,
  key: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

/* ================== HELPERS ================== */
const fmt = d => new Date(d).toISOString().slice(0,10);

async function tg(method, payload) {
  await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function send(chatId, text) {
  await tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  });
}

function allowed(id){ return ALLOWED_USERS.includes(String(id)); }

/* ================== SHEETS ================== */
async function getSheet(name){
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: name
  });
  return res.data.values || [];
}

/* ================== REPORT ================== */
async function reportByDate(date){
  const rows = await getSheet('DailySales');
  const r = rows.find(x => x[0] === date);
  if (!r) return `❌ Нет данных за ${date}`;

  return (
`📊 <b>Отчёт за ${date}</b>

🏦 Банки 1: <b>${r[1]} €</b>
🏦 Банки 2: <b>${r[2]} €</b>
💳 Карта: <b>${r[3]} €</b>
🅿️ PayPal: <b>${r[4]} €</b>
🏛 Перевод: <b>${r[5]} €</b>

💶 <b>Итого: ${r[6]} €</b>
📦 Заказов: ${r[7]}`
  );
}

async function payoutByDate(date){
  const rows = await getSheet('PayoutPlan');
  const list = rows.filter(r => r[0] === date);
  if (!list.length) return `❌ Нет поступлений на ${date}`;

  let total = 0;
  let text = `💰 <b>Поступления на ${date}</b>\n\n`;
  list.forEach(r=>{
    total += Number(r[2]||0);
    text += `• ${r[1]}: <b>${r[2]} €</b>\n`;
  });
  text += `\n💶 <b>Итого: ${total.toFixed(2)} €</b>`;
  return text;
}

/* ================== TELEGRAM ================== */
app.post('/telegram', async (req,res)=>{
  try{
    const msg = req.body.message;
    if(!msg) return res.sendStatus(200);

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = (msg.text||'').trim();

    if(!allowed(userId)){
      await send(chatId,'⛔ Нет доступа');
      return res.sendStatus(200);
    }

    if(text === '/start'){
      await send(chatId,'✅ <b>Aromat CashFlow</b>\nGoogle Sheets подключены.');
      return res.sendStatus(200);
    }

    if(text.includes('Отчёт')){
      await send(chatId,'Введи дату: YYYY-MM-DD');
      return res.sendStatus(200);
    }

    if(/^\d{4}-\d{2}-\d{2}$/.test(text)){
      await send(chatId, await reportByDate(text));
      return res.sendStatus(200);
    }

    if(text.includes('Поступ')){
      await send(chatId,'Введи дату поступлений: YYYY-MM-DD');
      return res.sendStatus(200);
    }

    await send(chatId,'Выбери команду 👇');
    res.sendStatus(200);

  }catch(e){
    console.error(e);
    res.sendStatus(200);
  }
});

/* ================== HEALTH ================== */
app.get('/',(_,res)=>res.send('OK'));

app.listen(PORT, ()=>console.log(`🚀 Server started on port ${PORT}`));
