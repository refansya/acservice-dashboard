const router = require("express").Router();
const { createAuthorizationUrl, saveAuthorizationCode, oauthConfigured, readToken } = require("../services/maintenanceReminderService");

router.get("/gmail/status", (req, res) => res.json({ configured: oauthConfigured(), connected: Boolean(readToken()?.refreshToken), email: process.env.GMAIL_USER || null }));
router.get("/gmail/connect", (req, res) => res.redirect(createAuthorizationUrl()));
router.get("/gmail/callback", async (req, res) => {
  if (req.query.error) return res.status(400).send(`<h2>Koneksi Gmail dibatalkan</h2><p>${req.query.error}</p>`);
  await saveAuthorizationCode(req.query.code, req.query.state);
  res.send("<h2>Gmail berhasil dihubungkan.</h2><p>Anda boleh menutup tab ini dan kembali ke Project.id Services.</p>");
});
module.exports = router;
