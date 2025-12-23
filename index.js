import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TG_TOKEN = process.env.TG_TOKEN;
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;

app.post("/telegram", async (req, res) => {
  try {
    console.log("UPDATE:", JSON.stringify(req.body));

    const message = req.body.message;
    if (!message) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = message.text || "";

    let reply = "🤖 Я жив, но пока думаю…";

    if (text === "/start") {
      reply = "✅ Aromat CashFlow онлайн\nНапиши что-нибудь.";
    }

    await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
      }),
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(200);
  }
});

app.get("/", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Bot listening on ${PORT}`);
});
