const CONFIG = {
  apiKey: "PAYKU_B8945B42C8954E81717F8252B75C9925", // Ganti dengan API Key Payku kamu
  secretKey: "d9b93c69582b7f42f27ea87eea61b1ec1dafa19e20b4bb7cbd47062df5859c50",    // Ganti dengan Secret Key Payku kamu
  baseURL: "https://payku.my.id",
};

document.getElementById("payBtn").addEventListener("click", async () => {
  const amount = document.getElementById("amount").value;
  const statusText = document.getElementById("status");

  if (!amount || amount < 1000) {
    statusText.innerText = "❌ Minimal pembayaran Rp 1.000";
    return;
  }

  statusText.innerText = "🔄 Membuat transaksi...";

  try {
    const res = await fetch(`${CONFIG.baseURL}/api/create-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apiKey": CONFIG.apiKey,
        "secretKey": CONFIG.secretKey,
      },
      body: JSON.stringify({
        amount: amount,
        method: "qris",
      }),
    });

    const data = await res.json();

    if (data.success) {
      document.querySelector(".qris-img").src = data.data.qrImage;
      statusText.innerText = "✅ Silakan scan QRIS untuk membayar.";
    } else {
      statusText.innerText = "❌ Gagal membuat pembayaran.";
    }
  } catch (err) {
    console.error(err);
    statusText.innerText = "⚠️ Terjadi kesalahan server.";
  }
});
