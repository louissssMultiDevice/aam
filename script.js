let cart = [];

function toggleCart() {
  document.getElementById("cart").classList.toggle("show");
}

function addToCart(title, price, sku) {
  cart.push({ title, price, sku });
  document.getElementById("cart-count").innerText = cart.length;
  renderCart();
}

function renderCart() {
  const list = document.getElementById("cart-list");
  list.innerHTML = "";
  cart.forEach((item, i) => {
    const li = document.createElement("li");
    li.innerHTML = `${item.title} - Rp${item.price.toLocaleString()} <button onclick="removeFromCart(${i})">x</button>`;
    list.appendChild(li);
  });
}

function removeFromCart(i) {
  cart.splice(i, 1);
  document.getElementById("cart-count").innerText = cart.length;
  renderCart();
}

async function checkout() {
  if (cart.length === 0) return alert("Keranjang kosong!");
  const item = cart[0]; // contoh ambil produk pertama saja
  const resp = await fetch("/api/create-transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: item.price,
      sku: item.sku,
      description: item.title,
      customer_name: "User",
      customer_email: "user@mail.com",
      customer_phone: "08123456789"
    })
  });
  const data = await resp.json();
  if (data.success) {
    document.getElementById("qrisImage").src = data.data.qris_url;
    document.getElementById("qrisModal").style.display = "flex";
    pollStatus(data.data.transaction_id);
  } else {
    alert("Gagal membuat transaksi: " + data.message);
  }
}

function closeQR() {
  document.getElementById("qrisModal").style.display = "none";
}

function pollStatus(transactionId) {
  let attempt = 0, max = 60;
  const interval = setInterval(async () => {
    attempt++;
    const res = await fetch(`/api/transaction/${transactionId}`);
    const d = await res.json();
    if (d.success && d.data.status === "paid") {
      clearInterval(interval);
      document.getElementById("statusText").innerText = "✅ Pembayaran Berhasil!";
    } else if (attempt >= max) {
      clearInterval(interval);
      document.getElementById("statusText").innerText = "❌ Pembayaran Gagal / Expired";
    }
  }, 5000);
}
