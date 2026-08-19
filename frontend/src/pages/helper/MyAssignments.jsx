import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import StatusBadge from "../../components/StatusBadge";

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("id-ID", { dateStyle: "medium" })
    : "Belum dijadwalkan";

export default function MyAssignments() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("ACTIVE");
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setData((await api.get("/helpers/my/assignments")).data);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memuat tugas");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const assignments = useMemo(
    () =>
      (data?.assignments || []).filter((a) =>
        tab === "ACTIVE"
          ? !["DONE", "INVOICED", "CANCELLED"].includes(a.order.status)
          : ["DONE", "INVOICED", "CANCELLED"].includes(a.order.status),
      ),
    [data, tab],
  );
  if (!data && !error) return <div>Memuat...</div>;
  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Tugas & Komisi Saya</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Total komisi tercatat:{" "}
        <b className="mono">{rupiah(data?.totalCommission)}</b>
      </p>
      {error && <div style={{ color: "var(--signal-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, margin: "18px 0" }}>
        <button
          className="btn"
          style={{
            background: tab === "ACTIVE" ? "var(--ice-400)" : "transparent",
          }}
          onClick={() => setTab("ACTIVE")}
        >
          Tugas Aktif
        </button>
        <button
          className="btn"
          style={{
            background: tab === "HISTORY" ? "var(--ice-400)" : "transparent",
          }}
          onClick={() => setTab("HISTORY")}
        >
          Riwayat
        </button>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {assignments.map((a) => {
          const order = a.order;
          const phone = (order.customer?.phone || "")
            .replace(/\D/g, "")
            .replace(/^0/, "62");
          const paid = order.invoice?.status === "PAID";
          return (
            <div className="card" key={a.id} style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    className="mono"
                    style={{ fontSize: 12, color: "var(--text-muted)" }}
                  >
                    {order.orderNumber}
                  </div>
                  <strong>{order.customer?.name}</strong>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginTop: 8,
                }}
              >
                {order.serviceType?.name} · {date(order.scheduledDate)}
              </div>
              <div style={{ fontSize: 13, marginTop: 5 }}>{order.address}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 12,
                  fontSize: 13,
                }}
              >
                <span>
                  Teknisi: {order.technician?.name || "Belum ditugaskan"}
                </span>
                <span className="mono" style={{ color: "var(--success)" }}>
                  {rupiah(a.commissionAmount)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: paid ? "var(--success)" : "var(--text-faint)",
                  marginTop: 5,
                }}
              >
                {paid
                  ? "Pembayaran pelanggan sudah lunas"
                  : "Komisi menunggu pembayaran pelanggan"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <a
                  className="btn btn-ghost"
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="btn btn-ghost"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Navigasi
                </a>
              </div>
            </div>
          );
        })}
        {!assignments.length && (
          <div
            className="card"
            style={{ padding: 18, color: "var(--text-muted)" }}
          >
            {tab === "ACTIVE"
              ? "Belum ada tugas aktif."
              : "Belum ada riwayat tugas."}
          </div>
        )}
      </div>
    </div>
  );
}
