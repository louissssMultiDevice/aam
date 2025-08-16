const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
app.use(bodyParser.json());

const CONFIG = {
  apiKey: process.env.PAYKU_API_KEY,
  secretKey: process.env.PAYKU_SECRET_KEY,
  baseURL: 'https://payku.my.id/api'
};

function generateSignature(data, secretKey, timestamp) {
  const payload = { ...data, timestamp };
  const sortedKeys = Object.keys(payload).sort();
  const str = sortedKeys.map(k => `${k}=${payload[k]}`).join('&');
  return crypto.createHmac('sha256', secretKey).update(str).digest('hex');
}

app.post('/api/create-transaction', async (req, res) => {
  try {
    const { amount, sku, description, customer_name, customer_email, customer_phone } = req.body;
    const timestamp = Date.now().toString();

    const body = {
      external_id: `ORDER_${Date.now()}`,
      amount,
      description,
      customer_name,
      customer_email,
      customer_phone,
      webhook_url: process.env.WEBHOOK_URL
    };

    const signature = generateSignature(body, CONFIG.secretKey, timestamp);

    const headers = {
      'X-API-Key': CONFIG.apiKey,
      'X-Signature': signature,
      'X-Timestamp': timestamp,
      'Content-Type': 'application/json'
    };

    const resp = await axios.post(`${CONFIG.baseURL}/create-transaction`, body, { headers });
    return res.json(resp.data);
  } catch (e) {
    console.error(e.response?.data || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/transaction/:id', async (req, res) => {
  try {
    const transactionId = req.params.id;
    const timestamp = Date.now().toString();

    const signature = generateSignature({}, CONFIG.secretKey, timestamp);
    const headers = {
      'X-API-Key': CONFIG.apiKey,
      'X-Signature': signature,
      'X-Timestamp': timestamp
    };

    const resp = await axios.get(`${CONFIG.baseURL}/transaction/${transactionId}`, { headers });
    return res.json(resp.data);
  } catch (e) {
    console.error(e.response?.data || e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/webhook', (req, res) => {
  console.log('Webhook Payku:', req.body);
  // Lakukan auto-delivery jika status == 'paid'
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend berjalan di http://localhost:${port}`));
