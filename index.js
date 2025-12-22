/****************************************************
 * Aromat CashFlow Bot — RENDER WEBHOOK
 * FULL PORT OF WORKING APPS SCRIPT
 ****************************************************/

import express from 'express';
import fetch from 'node-fetch';
import { google } from 'googleapis';

const app = express();
app.use(express.json());

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 10000;
const TZ = 'Europe/Tallinn';

// Telegram
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ALLOWED_USERS = ['1356353979','499185572'];

// InSales
const INS_API_KEY  = process.env.INS_API_KEY;
const INS_PASSWORD = process.env.INS_PASSWORD;
const INS_DOMAIN   = 'aromat.ee';
const INS_PER_PAGE = 50;

// Sheets
const SPREADSHEET_ID = '15S59Ms36TugiQAvxgLd5AX8urPVao5Quo0mnMvNt6aY';
const SHEET_DAILY   = 'DailySales';
const SHEET_PAYOUT  = 'PayoutPlan';
const SHEET_HOLIDAY = 'BankHolidays';

// Payment titles
const PAY = {
  BANK1: 'Оплата через банки (EE, FI, LV, LT, PL, DE)',
  BANK2: 'Оплата через банки (EE, LV, LT, PL, DE, BG, RO, SE, DK, CZ)',
  CARD:  'Оплата картой',
  PAYPAL:'Оплата через PayPal',
  TRANSFER:'Банковский перевод'
};

/* ================= GOOGLE ================= */

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

/* ================= TELEGRAM ================= */

async function tg(method, payload) {
  await fetch(`${TELEGRAM_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function keyboard() {
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

/* ================= HELPERS ================= */

const fmt = d => d.toISOString().slice(0,10);
const isWeekend = d => [0,6].includes(d.getDay());

async function loadHolidays() {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HOLIDAY}!A2:A`
  });
  const set = {};
  (r.data.values || []).forEach(([d]) => set[d] = true);
  return set;
}

function isBusinessDay(d, hol) {
  return !isWeekend(d) && !hol[fmt(d)];
}

function nextBusinessDay(d, hol) {
  const x = new Date(d);
  while (!isBusinessDay(x, hol)) x.setDate(x.getDate()+1);
  return x;
}

function addBusinessDays(d, n, hol) {
  const x = new Date(d);
  let i=0;
  while (i<n) {
    x.setDate(x.getDate()+1);
    if (isBusinessDay(x, hol)) i++;
  }
  return x;
}

/* ================= INSALES ================= */

async function fetchOrders(date) {
  const from = new Date(date); from.setHours(0,0,0,0);
  const to   = new Date(date); to.setHours(23,59,59,999);

  const auth = Buffer.from(`${INS_API_KEY}:${INS_PASSWORD}`).toString('base64');
  let page=1, out=[];

  while (true) {
    const r = await fetch(
      `https://${INS_DOMAIN}/admin/orders.json?page=${page}&per_page=${INS_PER_PAGE}`,
      { headers:{ Authorization:`Basic ${auth}` } }
    );
    const data = await r.json();
    if (!data.length) break;

    for (const o of data) {
      const c = new Date(o.created_at);
      if (c>=from && c<=to && (o.financial_status==='paid' || o.paid)) out.push(o);
    }
    if (new Date(data[data.length-1].created_at) < from) break;
    page++;
  }
  return out;
}

/* ================= CORE LOGIC ================= */

async function recalcDay(date) {
  const orders = await fetchOrders(date);
  const hol = await loadHolidays();

  const sums = { bank1:0, bank2:0, card:0, paypal:0, transfer:0 };
  const cnt  = { bank1:0, bank2:0, card:0, paypal:0, transfer:0 };

  for (const o of orders) {
    const t = o.payment_title;
    const a = Number(o.total_price||0);
    if (t===PAY.BANK1)  { sums.bank1+=a; cnt.bank1++; }
    if (t===PAY.BANK2)  { sums.bank2+=a; cnt.bank2++; }
    if (t===PAY.CARD)   { sums.card+=a;  cnt.card++; }
    if (t===PAY.PAYPAL) { sums.paypal+=a;cnt.paypal++; }
    if (t===PAY.TRANSFER){sums.transfer+=a;cnt.transfer++; }
  }

  const row = [
    fmt(date),
    sums.bank1,
    sums.bank2,
    sums.card,
    sums.paypal,
    sums.transfer,
    sums.bank1+sums.bank2+sums.card+sums.paypal+sums.transfer,
    orders.length,
    'EUR',
    'paid only'
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_DAILY}!A:J`,
    valueInputOption:'USER_ENTERED',
    requestBody:{ values:[row] }
  });

  const payouts = [];
  if (sums.bank1)
    payouts.push([fmt(nextBusinessDay(date,hol)), PAY.BANK1, sums.bank1, fmt(date), cnt.bank1]);
  if (sums.bank2)
    payouts.push([fmt(nextBusinessDay(date,hol)), PAY.BANK2, sums.bank2, fmt(date), cnt.bank2]);
  if (sums.card)
    payouts.push([fmt(addBusinessDays(nextBusinessDay(date,hol),3,hol)), PAY.CARD, sums.card, fmt(date), cnt.card]);
  if (sums.paypal)
    payouts.push([fmt(nextBusinessDay(date,hol)), PAY.PAYPAL, sums.paypal, fmt(date), cnt.paypal]);
  if (sums.transfer)
    payouts.push([fmt(nextBusinessDay(date,hol)), PAY.TRANSFER, sums.transfer, fmt(date), cnt.transfer]);

  if (payouts.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_PAYOUT}!A:E`,
      valueInputOption:'USER_ENTERED',
      requestBody:{ values:payouts }
    });
  }
}

/* ================= WEBHOOK ================= */

app.post('/telegram', async (req,res)=>{
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  if (!ALLOWED_USERS.includes(String(msg.from.id))) {
    await tg('sendMessage',{ chat_id:msg.chat.id, text:'⛔ Нет доступа' });
    return res.sendStatus(200);
  }

  if (msg.text?.includes('Пересчитать день')) {
    await tg('sendMessage',{
      chat_id:msg.chat.id,
      text:'Введите дату YYYY-MM-DD'
    });
    return res.sendStatus(200);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(msg.text)) {
    await recalcDay(new Date(msg.text));
    await tg('sendMessage',{
      chat_id:msg.chat.id,
      text:`✅ Пересчитано ${msg.text}`,
      reply_markup:keyboard()
    });
  }

  res.sendStatus(200);
});

/* ================= START ================= */

app.get('/',(_,res)=>res.send('OK'));
app.listen(PORT,()=>console.log('Server started on port',PORT));
