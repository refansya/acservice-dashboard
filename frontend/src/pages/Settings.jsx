import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/reminders/gmail/status");
      setStatus(data);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memuat status Gmail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    load();
    // Kalau tab ini balik aktif (mis. setelah user selesai otorisasi Gmail di
    // tab baru lalu kembali ke tab dashboard), refresh status otomatis -
    // supaya tidak perlu reload manual untuk lihat hasilnya.
    function handleFocus() {
      load();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user?.role]);

  if (user?.role !== "ADMIN") {
    return (
      <div>
        <PageHeader title="Pengaturan" subtitle="Akses terbatas" />
        <div className="card" style={{ padding: 20, maxWidth: 480 }}>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
            Halaman ini hanya bisa diakses oleh akun ADMIN.
          </div>
        </div>
      </div>
    );
  }

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      const { data } = await api.get("/reminders/gmail/connect");
      // Buka di tab baru supaya dashboard-nya tidak hilang - setelah selesai
      // otorisasi di Google, user tinggal balik ke tab ini (trigger di atas
      // otomatis refresh status-nya).
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memulai koneksi Gmail");
    } finally {
      setConnecting(false);
    }
  }

  // Job pengecekan reminder otomatis cuma jalan sekali saat server start lalu
  // sekali per 24 jam - jadi kalau Gmail baru saja dihubungkan, atau admin
  // butuh kirim ulang segera (mis. untuk testing), tombol ini kirim manual
  // tanpa perlu tunggu jadwal berikutnya.
  async function handleSendNow() {
    setSending(true);
    setSendResult(null);
    setError("");
    try {
      const { data } = await api.post("/reminders/gmail/send-now");
      setSendResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal mengirim reminder");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        subtitle="Koneksi email untuk reminder maintenance"
      />

      <div className="card" style={{ padding: 20, maxWidth: 560 }}>
        <h3 style={{ fontSize: 14.5, marginBottom: 4 }}>
          Reminder Maintenance via Gmail
        </h3>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          Sistem mengecek order MAINTENANCE yang sudah jatuh tempo tiap hari,
          dan mengirim email pengingat lewat akun Gmail ini kalau sudah
          terhubung.
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
            Memuat status...
          </div>
        )}

        {!loading && status && (
          <>
            {!status.configured && (
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--signal-red)",
                  background: "rgba(220, 60, 60, 0.08)",
                  border: "1px solid rgba(220, 60, 60, 0.25)",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                Kredensial Google OAuth belum diisi di server (
                <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>
                , <code>GMAIL_USER</code>). Hubungi yang mengelola deployment
                untuk melengkapi ini dulu di Environment Variables backend.
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderTop: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {status.email || "Belum ada akun terdaftar"}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-faint)" }}
                >
                  GMAIL_USER
                </div>
              </div>
              <StatusBadge status={status.connected ? "ACTIVE" : "INACTIVE"} />
            </div>

            {error && (
              <div
                style={{
                  color: "var(--signal-red)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={!status.configured || connecting}
              onClick={handleConnect}
            >
              {connecting
                ? "Membuka halaman Google..."
                : status.connected
                  ? "Hubungkan Ulang Gmail"
                  : "Hubungkan Gmail"}
            </button>
            {status.connected && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  marginTop: 8,
                  marginBottom: 16,
                }}
              >
                Sudah terhubung. Klik lagi hanya kalau perlu ganti izin akses
                atau koneksinya bermasalah.
              </div>
            )}

            {status.connected && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    marginBottom: 10,
                  }}
                >
                  Sistem otomatis cek reminder jatuh tempo sekali sehari. Kalau
                  baru menghubungkan Gmail atau butuh kirim ulang segera, kirim
                  manual di sini.
                </div>
                <button
                  className="btn btn-ghost"
                  disabled={sending}
                  onClick={handleSendNow}
                >
                  {sending ? "Mengirim..." : "Kirim Reminder Sekarang"}
                </button>
                {sendResult && (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--success)",
                      marginTop: 8,
                    }}
                  >
                    {sendResult.sent > 0
                      ? `${sendResult.sent} email reminder berhasil dikirim.`
                      : "Tidak ada order maintenance yang jatuh tempo saat ini."}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
