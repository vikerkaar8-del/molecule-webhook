import express from 'express';

const app = express();
app.use(express.json());

// корень — проверка, что сервер жив
app.get('/', (req, res) => {
  res.send('✅ Molecule test server is running');
});

// фейковый webhook — просто логируем вход
app.post('/webhook', (req, res) => {
  console.log('📩 Webhook received:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Server started on port', PORT);
});
