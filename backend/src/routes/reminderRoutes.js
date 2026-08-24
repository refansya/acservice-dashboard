const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const {
  createAuthorizationUrl,
  saveAuthorizationCode,
  oauthConfigured,
  readToken,
  sendMaintenanceReminders,
} = require("../services/maintenanceReminderService");

// Status & connect dibatasi untuk ADMIN yang sudah login - sebelumnya endpoint
// ini tidak pakai autentikasi sama sekali, jadi siapa saja yang tahu URL-nya
// bisa memicu OAuth flow atau lihat status koneksi Gmail.
router.get("/gmail/status", authenticate, authorize("ADMIN"), (req, res) =>
  res.json({ configured: oauthConfigured(), connected: Boolean(readToken()?.refreshToken), email: process.env.GMAIL_USER || null }),
);
// Trigger manual - job otomatis cuma jalan sekali saat server start lalu tiap
// 24 jam, jadi kalau Gmail baru saja dihubungkan (atau admin butuh kirim
// ulang segera untuk testing), tidak perlu tunggu jadwal berikutnya.
router.post("/gmail/send-now", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const result = await sendMaintenanceReminders();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Mengembalikan URL otorisasi sebagai JSON (bukan redirect langsung), karena
// navigasi browser biasa tidak membawa header Authorization kita. Frontend
// yang memanggil endpoint ini lewat axios (dengan token), lalu baru browser
// diarahkan manual ke URL Google-nya lewat window.location.
router.get("/gmail/connect", authenticate, authorize("ADMIN"), (req, res) => {
  try {
    res.json({ url: createAuthorizationUrl() });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Callback TIDAK bisa pakai authenticate (Google me-redirect browser ke sini
// tanpa membawa Authorization header kita) - keamanannya bergantung pada
// parameter "state" sekali-pakai yang divalidasi di saveAuthorizationCode.
router.get("/gmail/callback", async (req, res) => {
  if (req.query.error) return res.status(400).send(`<h2>Koneksi Gmail dibatalkan</h2><p>${req.query.error}</p>`);
  try {
    await saveAuthorizationCode(req.query.code, req.query.state);
    res.send("<h2>Gmail berhasil dihubungkan.</h2><p>Anda boleh menutup tab ini dan kembali ke Project.id Services.</p>");
  } catch (error) {
    res.status(error.status || 500).send(`<h2>Gagal menghubungkan Gmail</h2><p>${error.message}</p>`);
  }
});
module.exports = router;