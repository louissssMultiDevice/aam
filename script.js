let cart = [];

/* =====================
   🔹 CART HANDLER
===================== */
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
    li.innerHTML = `
      ${item.title} - Rp${item.price.toLocaleString()} 
      <button onclick="removeFromCart(${i})">x</button>
    `;
    list.appendChild(li);
  });
}

function removeFromCart(i) {
  cart.splice(i, 1);
  document.getElementById("cart-count").innerText = cart.length;
  renderCart();
}

/* =====================
   🔹 PAYMENT HANDLER
===================== */
async function payNow(title, price, sku) {
  try {
    const resp = await fetch("https://payku.my.id/api/create-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: price,
        sku,
        description: title,
        customer_name: "Buyer",
        customer_email: "buyer@nami.com",
        customer_phone: "081234567890",
      }),
    });

    const data = await resp.json();
    if (data.success) {
      showQRModal(data.data.qris_url);
      pollStatus(data.data.transaction_id);
    } else {
      alert("Gagal membuat transaksi: " + data.message);
    }
  } catch (err) {
    console.error("Error payNow:", err);
    alert("Terjadi kesalahan saat membuat transaksi");
  }
}

async function checkout() {
  if (cart.length === 0) return alert("Keranjang kosong!");
  const item = cart[0]; // ambil produk pertama (bisa dikembangkan jadi multi-item)

  payNow(item.title, item.price, item.sku);
}

/* =====================
   🔹 QRIS MODAL HANDLER
===================== */
function showQRModal(qrisUrl) {
  document.getElementById("qrisImage").src = qrisUrl;
  document.getElementById("qrisModal").style.display = "flex";
  document.getElementById("statusText").innerText = "Menunggu pembayaran...";
}

function closeQR() {
  document.getElementById("qrisModal").style.display = "none";
}

function showPaidSuccess(data) {
  document.getElementById("statusText").innerText = "✅ Pembayaran Berhasil!";
  console.log("Payment data:", data);
}

function showExpired() {
  document.getElementById("statusText").innerText =
    "❌ Pembayaran Gagal / Expired";
}

/* =====================
   🔹 PAYMENT STATUS POLLING
===================== */
function pollStatus(transactionId) {
  let attempts = 0;
  const max = 60;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/api/transaction/${transactionId}`);
      const d = await res.json();

      if (d.success && d.data.status === "paid") {
        clearInterval(interval);
        showPaidSuccess(d.data);
      } else if (attempts >= max) {
        clearInterval(interval);
        showExpired();
      }
    } catch (err) {
      console.error("Error polling:", err);
    }
  }, 5000);
}
