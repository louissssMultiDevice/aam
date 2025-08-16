/*
  server.js
  - Express backend
  - Endpoints:
    POST /api/create-transaction    -> buat transaksi QRIS (panggil Payku)
    GET  /api/transaction/:id       -> cek status transaksi
    POST /api/transaction/:id/cancel-> batalkan transaksi
    POST /api/payment-callback     -> webhook dari Payku (auto-delivery)

  NOTE: Simpan secret keys di ENV variables sebelum deploy.
*/

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- CONFIG (gunakan ENV saat produksi) ----------
const CONFIG = {
  apiKey: process.env.PAYKU_API_KEY || 'PAYKU_B8945B42C8954E81717F8252B75C9925',
  secretKey: process.env.PAYKU_SECRET_KEY || 'd9b93c69582b7f42f27ea87eea61b1ec1dafa19e20b4bb7cbd47062df5859c50',
  baseURL: process.env.PAYKU_BASE_URL || 'https://payku.my.id',
  minAmount: 100,
  maxChecks: 60,
  checkInterval: 5000
};

// Simpel storage in-memory (untuk demo). Ganti dengan DB untuk produksi.
const transactions = new Map();
const inventory = {
  'nokos_all_01': { sku: 'nokos_all_01', title: 'NOKOS All Region', price: 5000, stock: 9999, autoDeliver: true },
  'panel_1GB': { sku: 'panel_1GB', title: 'Panel Bot 1GB', price: 25000, stock: 10, autoDeliver: false }
};

function generateSignature(data, secretKey) {
  const sortedKeys = Object.keys(data).sort();
  const stringToSign = sortedKeys.map(k => `${k}=${data[k]}`).join('&');
  return crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');
}

function createHeaders(data, timestamp) {
  const signature = generateSignature(data, CONFIG.secretKey);
  return {
    'x-api-key': CONFIG.apiKey,
    'x-signature': signature,
    'x-timestamp': timestamp,
    'Content-Type': 'application/json'
  };
}

// ----- Helpers -----
function sanitizePhone(phone) {
  return (phone || '081000000000').toString().replace(/[^0-9]/g, '');
}

// ---------- Routes ----------

// Create transaction (frontend akan memanggil ini)
app.post('/api/create-transaction', async (req, res) => {
  try {
    const { amount, sku, description, customer_phone, customer_name } = req.body;

    if (!amount || amount < CONFIG.minAmount) return res.json({ success: false, message: 'Nominal tidak valid' });

    const timestamp = Date.now().toString();
    const sanitizedPhone = sanitizePhone(customer_phone || '081000000000');

    const transactionData = {
      external_id: `WEB-${sanitizedPhone}-${Date.now()}`,
      amount: amount,
      description: description || 'Pembelian di Warung Pedia',
      customer_name: customer_name || `Buyer-${sanitizedPhone.slice(-4)}`,
      customer_email: `${sanitizedPhone}@example.com`,
      customer_phone: sanitizedPhone,
      timestamp
    };

    const headers = createHeaders(transactionData, timestamp);

    // Panggil Payku create-transaction API
    const resp = await axios.post(`${CONFIG.baseURL}/api/create-transaction`, transactionData, { headers });

    if (!resp.data || !resp.data.success) {
      return res.json({ success: false, message: resp.data?.message || 'Gagal membuat transaksi' });
    }

    const tx = resp.data.data;

    // Simpan minimal info di memory
    transactions.set(tx.transaction_id, {
      transaction_id: tx.transaction_id,
      amount: tx.amount,
      qris_url: tx.qris_url,
      status: tx.status || 'pending',
      createdAt: Date.now(),
      sku: sku || null
    });

    return res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error('create-transaction error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Check transaction status
app.get('/api/transaction/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const timestamp = Date.now().toString();

    const payload = { timestamp };
    const sortedKeys = Object.keys(payload).sort();
    const stringToSign = sortedKeys.map(k => `${k}=${payload[k]}`).join('&');
    const signature = crypto.createHmac('sha256', CONFIG.secretKey).update(stringToSign).digest('hex');

    const headers = { 'x-api-key': CONFIG.apiKey, 'x-signature': signature, 'x-timestamp': timestamp };
    const resp = await axios.get(`${CONFIG.baseURL}/api/transaction/${id}`, { headers });

    if (!resp.data || !resp.data.success) return res.json({ success: false, message: resp.data?.message || 'Gagal cek transaksi' });

    const statusData = resp.data.data;

    // sync local memory store
    if (transactions.has(id)) {
      const local = transactions.get(id);
      local.status = statusData.status;
      local.paid_at = statusData.paid_at || local.paid_at;
      transactions.set(id, local);
    }

    return res.json({ success: true, ...statusData, status: statusData.status });
  } catch (err) {
    console.error('check transaction error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Cancel transaction
app.post('/api/transaction/:id/cancel', async (req, res) => {
  try {
    const transactionId = req.params.id;
    const timestamp = Date.now().toString();
    const data = { transaction_id: transactionId, timestamp };
    const headers = createHeaders(data, timestamp);
    const resp = await axios.post(`${CONFIG.baseURL}/api/transaction/${transactionId}/cancel`, {}, { headers });

    if (!resp.data || !resp.data.success) return res.json({ success: false, message: resp.data?.message || 'Gagal membatalkan' });

    if (transactions.has(transactionId)) transactions.delete(transactionId);

    return res.json({ success: true, message: resp.data.message });
  } catch (err) {
    console.error('cancel error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: err.response?.data?.message || err.message });
  }
});

// Webhook / Callback dari Payku (setup di dashboard Payku ke this endpoint)
app.post('/api/payment-callback', async (req, res) => {
  try {
    // Pastikan verifikasi signature / apiKey sesuai implementasi Payku
    const payload = req.body;
    console.log('Received webhook:', payload);

    // contoh payload minimal: { transaction_id, status, amount, external_id, paid_at }
    const txid = payload.transaction_id;
    const status = (payload.status || '').toLowerCase();

    if (transactions.has(txid)) {
      const tx = transactions.get(txid);
      tx.status = payload.status;
      tx.paid_at = payload.paid_at || tx.paid_at;
      transactions.set(txid, tx);

      // Auto-delivery: cek SKU yang disimpan sebelumnya
      if (tx.sku) {
        const sku = tx.sku;
        const product = inventory[sku];
        if (product && product.autoDeliver && status === 'paid') {
          // contoh auto delivery: buat kode dan log ke file (ganti ke DB atau kirim WA/email)
          const kode = `KODE-${sku.toUpperCase()}-${Date.now().toString().slice(-6)}`;
          const delivery = { txid, sku, kode, deliveredAt: new Date().toISOString() };

          // simpan ke file deliveries.json
          const file = path.join(__dirname, 'deliveries.json');
          let all = [];
          try { all = JSON.parse(fs.readFileSync(file, 'utf8')||'[]'); } catch(e){}
          all.push(delivery);
          fs.writeFileSync(file, JSON.stringify(all, null, 2));

          console.log(`Auto-delivered ${sku} for tx ${txid}: ${kode}`);

          // TODO: kirim kode ke customer via WhatsApp / email
        }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('webhook error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Simple admin endpoint untuk melihat transaksi (demo)
app.get('/admin/transactions', (req, res) => {
  const list = Array.from(transactions.values());
  res.json({ success: true, data: list });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));