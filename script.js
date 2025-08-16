// Frontend logic: memanggil backend endpoints yang ada di server.js

const productCatalog = {
  'nokos_all_01': { sku:'nokos_all_01', title: 'NOKOS All Region', price: 5000 },
  'panel_1GB': { sku:'panel_1GB', title: 'Panel Bot 1GB', price: 25000 }
};

const productSelect = document.getElementById('productSelect');
const amountInput = document.getElementById('amountInput');
const phoneInput = document.getElementById('phoneInput');
const payBtn = document.getElementById('payBtn');
const result = document.getElementById('result');

productSelect.addEventListener('change', ()=>{
  const sku = productSelect.value;
  amountInput.value = productCatalog[sku].price;
});

async function createTransaction(amount, sku, phone) {
  try {
    const payload = { amount: parseInt(amount), sku, description: productCatalog[sku].title, customer_phone: phone };
    const res = await fetch('/api/create-transaction', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    return await res.json();
  } catch (e) {
    console.error('createTransaction error', e);
    return { success:false, message: e.message };
  }
}

function renderQR(tx) {
  result.innerHTML = `
    <div class="card">
      <div>ID Transaksi: ${tx.transaction_id}</div>
      <img class="qr" src="${tx.qris_url}" alt="QRIS" />
      <div>Nominal: Rp${tx.amount.toLocaleString()}</div>
      <div class="muted">Tunggu hingga payment terdeteksi otomatis.</div>
    </div>
  `;
}

let pollTimer = null;
async function pollStatus(transactionId) {
  let checks = 0;
  const max = 60;
  pollTimer = setInterval(async ()=>{
    try{
      const res = await fetch('/api/transaction/' + transactionId);
      const data = await res.json();
      if(data.success && data.status){
        if(data.status === 'paid'){
          clearInterval(pollTimer);
          result.innerHTML += `<div class="card" style="background:#10331a;color:#bfffca">Pembayaran diterima — Metode: ${data.payment_method||'QRIS'}</div>`;
          // Bisa ambil auto-delivery di admin API atau webhook
        } else if(data.status === 'expired' || data.status === 'cancelled'){
          clearInterval(pollTimer);
          result.innerHTML += `<div class="card">Status: ${data.status}</div>`;
        }
      }
    }catch(e){console.error('poll error',e)}
    checks++;
    if(checks>=max){ clearInterval(pollTimer); result.innerHTML += `<div class="card">QRIS expired (waktu habis).</div>`; }
  }, 5000);
}

payBtn.addEventListener('click', async ()=>{
  const sku = productSelect.value;
  const amount = amountInput.value;
  const phone = phoneInput.value;
  result.innerHTML = `<div class="card">Membuat transaksi...</div>`;
  const r = await createTransaction(amount, sku, phone);
  if(!r.success){ result.innerHTML = `<div class="card">Gagal: ${r.message}</div>`; return; }
  renderQR(r.transaction);
  pollStatus(r.transaction.transaction_id);
});