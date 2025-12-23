import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const GAS_URL = "https://script.google.com/macros/s/AKfycbzH8rDFuECt4Bx3JjvAp15lVUZu5nZdv79y-FWUNSZwcLxMVv8uSk4BqxvVzb0hATROiA/exec";

const TELEGRAM_API = `https://api.telegram.org/bot${TG_TOKEN}`;

app.post("/telegram", async (req, res) => {
  // 🔥 1. СРАЗУ отвечаем Telegram
  res.sendStatus(200);

  try {
    const msg = req.body.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // 👇 2. Всё остальное — уже ПОСЛЕ ответа
    let action = null;

    if (text === "/start") {
      await send(chatId, "✅ Aromat CashFlow готов к работе");
      return;
    }

    if (text === "/today") action = "report_day";
    if (text === "/yesterday") action = "report_day";
    if (text === "/week") action = "report_range";
    if (text === "/payout") action = "payout_day";

    if (!action) {
      await send(chatId, "❓ Неизвестная команда");
      return;
    }

    const payload = {
      action,
      date: getDateByCmd(text)
    };

    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await r.json();
    await send(chatId, json.text || "Нет данных");

  } catch (e) {
    console.error(e);
  }
});

async function send(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    })
  });
}

function getDateByCmd(cmd) {
  const d = new Date();
  if (cmd === "/yesterday") d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Webhook bot started");
});
