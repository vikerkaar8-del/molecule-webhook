import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;

const PORT = process.env.PORT || 10000;

console.log("🚀 TG_TOKEN exists:", !!TG_TOKEN);
console.log("🚀 TG_API:", TG_API);

// 👉 WEBHOOK
app.post("/telegram", async (req, res) => {
  try {
    const update = req.body;
    console.log("📩 UPDATE:", JSON.stringify(update));

    if (!update.message) {
      return res.sendStatus(200);
    }

    const chatId = update.message.chat.id;
    const text = update.message.text || "";

    // 👇 ПРОСТОЙ ОТВЕТ
    await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `👋 Бот жив!\nТы написал: ${text}`
      })
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR:", err);
    res.sendStatus(500);
  }
});

// 👉 ROOT (чтобы не было Cannot GET /)
app.get("/", (req, res) => {
  res.send("Aromat CashFlow Bot is running 🚀");
});

app.listen(PORT, () => {
  console.log(`🤖 Bot listening on ${PORT}`);
});
