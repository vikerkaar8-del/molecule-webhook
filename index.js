import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;

console.log("🚀 TG_TOKEN exists:", !!TG_TOKEN);
console.log("🚀 TG_API:", TG_API);

// healthcheck
app.get("/", (req, res) => {
  res.send("OK");
});

// webhook
app.post("/telegram", async (req, res) => {
  const update = req.body;
  console.log("📩 UPDATE:", JSON.stringify(update));

  try {
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      let reply = "👋 Я жив, но не понял команду";

      if (text === "/start") {
        reply =
          "👋 Привет!\n\n" +
          "Я — Aromat CashFlow Bot 💰\n" +
          "Готов помогать с отчётами и поступлениями.\n\n" +
          "Напиши любую команду ✨";
      }

      await fetch(`${TG_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply,
        }),
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR:", err);
    res.sendStatus(500);
  }
});

// Render port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🤖 Bot listening on ${PORT}`);
});
