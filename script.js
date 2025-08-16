// Simulasi Integrasi QRIS Payku
const API_KEY = "PAYKU_B8945B42C8954E81717F8252B75C9925";
const SECRET_KEY = "d9b93c69582b7f42f27ea87eea61b1ec1dafa19e20b4bb7cbd47062df5859c50";

document.querySelectorAll(".bayar").forEach(btn => {
  btn.addEventListener("click", async () => {
    const produk = btn.dataset.produk;
    const harga = btn.dataset.harga;

    alert(`Membuat transaksi untuk: ${produk} | Rp${harga}`);

    // Fetch API Payku
    const response = await fetch("https://payku.my.id/api/qris/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apiKey": API_KEY,
        "secretKey": SECRET_KEY
      },
      body: JSON.stringify({
        amount: harga,
        note: produk,
        method: "qris"
      })
    });

    const data = await response.json();
    if (data.status === "success") {
      document.getElementById("qris-container").innerHTML = `
        <h3>Scan QRIS</h3>
        <img src="${data.data.qrImage}" alt="QRIS Code" width="250">
        <p><strong>ID Transaksi:</strong> ${data.data.invoiceId}</p>
      `;
    } else {
      alert("Gagal membuat transaksi!");
    }
  });
});}

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
