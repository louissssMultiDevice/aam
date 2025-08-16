// server.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// Konfigurasi dari Payku
const CONFIG = {
  apiKey: 'PAYKU_B8945B42C8954E81717F8252B75C9925',
  secretKey: 'd9b93c69582b7f42f27ea87eea61b1ec1dafa19e20b4bb7cbd47062df5859c50',
  baseURL: 'https://payku.my.id/api'
};

// Fungsi generate signature sesuai dokumentasi
function generateSignature(payload, secretKey, timestamp) {
  const data = { ...payload, timestamp };
  const sortedKeys = Object.keys(data).sort();
  const stringToSign = sortedKeys.map(k => `${k}=${data[k]}`).join('&');
  return crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');
}

// Endpoint buat transaksi QRIS
app.post('/api/create-transaction', async (req, res) => {
  try {
    const { amount, description, customer_name, customer_email, customer_phone, webhook_url } = req.body;
    const external_id = `ORDER_${Date.now()}`;
    const payload = { external_id, amount, description, customer_name, customer_email, customer_phone, webhook_url };
    const timestamp = Date.now().toString();
    const signature = generateSignature(payload, CONFIG.secretKey, timestamp);

    const resp = await axios.post(`${CONFIG.baseURL}/create-transaction`, payload, {
      headers: {
        'X-API-Key': CONFIG.apiKey,
        'X-Signature': signature,
        'X-Timestamp': timestamp,
        'Content-Type': 'application/json'
      }
    });
    return res.json(resp.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Endpoint cek status transaksi
app.get('/api/transaction/:transaction_id', async (req, res) => {
  try {
    const transaction_id = req.params.transaction_id;
    const timestamp = Date.now().toString();
    const signature = generateSignature({}, CONFIG.secretKey, timestamp);

    const resp = await axios.get(`${CONFIG.baseURL}/transaction/${transaction_id}`, {
      headers: {
        'X-API-Key': CONFIG.apiKey,
        'X-Signature': signature,
        'X-Timestamp': timestamp
      }
    });
    return res.json(resp.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Webhook Payku untuk auto delivery
app.post('/api/webhook', (req, res) => {
  console.log('Webhook Payku received:', req.body);
  // Jika status 'paid', bisa implementasi auto-delivery di sini
  res.json({ success: true });
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
