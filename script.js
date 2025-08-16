const payBtn = document.getElementById('payBtn');
const amountEl = document.getElementById('amount');
const qrisContainer = document.getElementById('qrisContainer');
const statusTxt = document.getElementById('statusTxt');

payBtn.onclick = async () => {
  const amount = parseInt(amountEl.value);
  if (!amount || amount < 100) return statusTxt.innerText = 'Masukkan nominal minimal 100';

  statusTxt.innerText = 'Membuat transaksi...';
  const resp = await fetch('/api/create-transaction', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      amount,
      description: 'Pembayaran digital',
      customer_name: 'Buyer',
      customer_email: 'buyer@example.com',
      customer_phone: '081234567890',
      webhook_url: `${window.location.origin}/api/webhook`
    })
  });
  const data = await resp.json();

  if (data.success) {
    const { qris_url, transaction_id } = data.data;
    qrisContainer.innerHTML = `<img src="${qris_url}" alt="QRIS Code" />`;
    statusTxt.innerText = 'Scan QRIS dan tunggu deteksi otomatis...';
    pollStatus(transaction_id);
  } else {
    statusTxt.innerText = 'Error: ' + data.message;
  }
};

function pollStatus(txId) {
  let attempts = 0;
  const max = 60;
  const interval = setInterval(async () => {
    attempts++;
    const resp = await fetch(`/api/transaction/${txId}`);
    const d = await resp.json();
    if (d.success && d.data.status === 'paid') {
      clearInterval(interval);
      statusTxt.innerText = '✅ Pembayaran sukses!';
    } else if (attempts >= max) {
      clearInterval(interval);
      statusTxt.innerText = '⏳ QRIS expired';
    }
  }, 5000);
}
