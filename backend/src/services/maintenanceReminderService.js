const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const prisma = require("../config/prisma");

const ADMIN_EMAIL = process.env.REMINDER_ADMIN_EMAIL || "projectidservice@gmail.com";
const TOKEN_FILE = path.join(__dirname, "..", "..", "data", "gmail-oauth.json");
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const pendingStates = new Set();

function redirectUri() { return process.env.GMAIL_REDIRECT_URI || "http://localhost:4000/api/reminders/gmail/callback"; }
function oauthConfigured() { return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_USER); }
function readToken() { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")); } catch { return null; } }
function saveToken(token) { fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true }); fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 }); }

function createAuthorizationUrl() {
  if (!oauthConfigured()) throw Object.assign(new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GMAIL_USER wajib diisi di backend/.env"), { status: 400 });
  const state = crypto.randomBytes(24).toString("hex");
  pendingStates.add(state);
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code", access_type: "offline", prompt: "consent", scope: "https://mail.google.com/", state });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

async function saveAuthorizationCode(code, state) {
  if (!pendingStates.delete(state)) throw Object.assign(new Error("Sesi otorisasi tidak valid atau sudah kedaluwarsa. Mulai koneksi Gmail lagi."), { status: 400 });
  const body = new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(), grant_type: "authorization_code" });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json();
  if (!response.ok || !payload.refresh_token) throw Object.assign(new Error(payload.error_description || "Google tidak mengembalikan refresh token. Coba hubungkan ulang dan izinkan akses Gmail."), { status: 400 });
  saveToken({ refreshToken: payload.refresh_token, connectedAt: new Date().toISOString() });
}

async function accessToken() {
  const token = readToken();
  if (!token?.refreshToken || !oauthConfigured()) return null;
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: token.refreshToken, grant_type: "refresh_token" });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || "Gagal memperbarui token Gmail");
  return payload.access_token;
}

async function configuredTransport() {
  const token = await accessToken();
  if (!token) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { type: "OAuth2", user: process.env.GMAIL_USER, clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, refreshToken: readToken().refreshToken, accessToken: token } });
}

async function sendMaintenanceReminders() {
  const transport = await configuredTransport();
  if (!transport) { console.warn("Reminder email belum dikirim: OAuth Gmail belum dihubungkan."); return { sent: 0, configured: false }; }
  const dueOrders = await prisma.order.findMany({ where: { serviceType: { code: "MNT" }, reminderDate: { lte: new Date() }, reminderSentAt: null, status: { in: ["DONE", "INVOICED"] } }, include: { customer: true, technician: true, serviceType: true }, orderBy: { reminderDate: "asc" } });
  let sent = 0;
  for (const order of dueOrders) {
    const message = [`Reminder preventive maintenance telah jatuh tempo.`, "", `Order: ${order.orderNumber}`, `Pelanggan: ${order.customer.name}`, `WhatsApp: ${order.customer.phone}`, `Alamat: ${order.address}`, `Unit: ${[order.serviceItem, order.brand].filter(Boolean).join(" - ") || order.serviceType.name}`, `Teknisi terakhir: ${order.technician?.name || "-"}`, `Jatuh tempo: ${new Date(order.reminderDate).toLocaleDateString("id-ID")}`].join("\n");
    await transport.sendMail({ from: process.env.GMAIL_USER, to: ADMIN_EMAIL, subject: `Reminder MNT - ${order.customer.name} (${order.orderNumber})`, text: message });
    await prisma.order.updateMany({ where: { id: order.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } }); sent += 1;
  }
  return { sent, configured: true };
}

function startMaintenanceReminderJob() { sendMaintenanceReminders().catch((error) => console.error("Gagal memproses email reminder:", error.message)); setInterval(() => sendMaintenanceReminders().catch((error) => console.error("Gagal memproses email reminder:", error.message)), 24 * 60 * 60 * 1000); }
module.exports = { sendMaintenanceReminders, startMaintenanceReminderJob, createAuthorizationUrl, saveAuthorizationCode, oauthConfigured, readToken };
