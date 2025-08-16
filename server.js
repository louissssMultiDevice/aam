// server.js (minimal example)
// RUN: npm i express axios body-parser crypto
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

const CONFIG = {
  apiKey: 'PAYKU_B8945B42C8954E81717F8252B75C9925',
  secretKey: 'd9b93c69582b7f42f27ea87eea61b1ec1dafa19e20b4bb7cbd47062df5859c50',
  baseURL: 'https://payku.my.id',
  minAmount: 100,
  maxChecks: 60,
  checkInterval: 5000
};

function generateSignature(data, secretKey){
  const sortedKeys = Object.keys(data).sort();
  const stringToSign = sortedKeys.map(k=>`${k}=${data[k]}`).join('&');
  return crypto.createHmac('sha256', secretKey).update(stringToSign).digest('hex');
}

function createHeaders(data, timestamp){
  const signature = generateSignature(data, CONFIG.secretKey);
  return {
    'x-api-key': CONFIG.apiKey,
    'x-signature': signature,
    'x-timestamp': timestamp,
    'Content-Type': 'application/json'
  };
}

// store minimal transactions
const transactions = new Map();

app.post('/api/create-transaction', async (req,res)=>{
  try{
    const { amount, sku, description } = req.body;
    if(!amount || amount < CONFIG.minAmount) return res.json({success:false,message:'Nominal tidak valid'});
    const timestamp = Date.now().toString();
    const sanitized = (Math.random()*1e6|0).toString();
    const transactionData = {
      external_id: `WEB-${sanitized}-${Date.now()}`,
      amount,
      description: description || 'Pembelian',
      customer_name: 'Buyer',
      customer_email: `${sanitized}@example.com`,
      customer_phone: '081000000000',
      timestamp
    };
    const headers = createHeaders(transactionData, timestamp);
    const resp = await axios.post(`${CONFIG.baseURL}/api/create-transaction`, transactionData, { headers });
    if(!resp.data.success) return res.json({ success:false, message: resp.data.message || 'Gagal' });
    const tx = resp.data.data;
    transactions.set(tx.transaction_id, tx);
    return res.json({ success:true, transaction: tx });
  }catch(err){
    console.error(err.message);
    return res.json({ success:false, message: err.response?.data?.message || err.message });
  }
});

app.get('/api/transaction/:id', async (req,res)=>{
  try{
    const id = req.params.id;
    const timestamp = Date.now().toString();
    // only timestamp signed for status check per your example
    const payload = { timestamp };
    const sortedKeys = Object.keys(payload).sort();
    const stringToSign = sortedKeys.map(k => `${k}=${payload[k]}`).join('&');
    const signature = crypto.createHmac('sha256', CONFIG.secretKey).update(stringToSign).digest('hex');
    const headers = { 'x-api-key': CONFIG.apiKey, 'x-signature': signature, 'x-timestamp': timestamp };
    const resp = await axios.get(`${CONFIG.baseURL}/api/transaction/${id}`, { headers });
    if(!resp.data.success) return res.json({ success:false, message: resp.data.message });
    return res.json({ success:true, ...resp.data.data, status: resp.data.data.status });
  }catch(err){
    console.error(err.message);
    return res.json({ success:false, message: err.response?.data?.message || err.message });
  }
});

app.post('/api/transaction/:id/cancel', async (req,res)=>{
  try{
    const transactionId = req.params.id;
    const timestamp = Date.now().toString();
    const data = { transaction_id: transactionId, timestamp };
    const headers = createHeaders(data, timestamp);
    const resp = await axios.post(`${CONFIG.baseURL}/api/transaction/${transactionId}/cancel`, {}, { headers });
    if(!resp.data.success) return res.json({ success:false, message: resp.data.message });
    return res.json({ success:true, message: resp.data.message });
  }catch(err){
    console.error(err.message);
    return res.json({ success:false, message: err.response?.data?.message || err.message });
  }
});

app.listen(3000, ()=>console.log('Server running on :3000'));
  
  
