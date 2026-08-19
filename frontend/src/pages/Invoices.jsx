import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [fullPay, setFullPay] = useState(true);
  const [payError, setPayError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/invoices", {
      params: statusFilter ? { status: statusFilter } : {},
    });
    setInvoices(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function invoicePaid(inv) {
    return (inv.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  }

  function openPay(inv) {
    const remaining = Number(inv.total) - invoicePaid(inv);
    setPayTarget(inv);
    setFullPay(true);
    setAmount(String(remaining));
    setMethod("CASH");
    setPayError("");
  }

  async function handleMarkPaid() {
    setPayError("");
    try {
      const remaining = Number(payTarget.total) - invoicePaid(payTarget);
      const payAmount = fullPay ? remaining : Number(amount || 0);
      await api.post(`/invoices/${payTarget.id}/payments`, {
        amount: payAmount,
        method,
      });
      setPayTarget(null);
      load();
    } catch (err) {
      setPayError(err.response?.data?.error || "Gagal mencatat pembayaran");
    }
  }

  async function handleReceipt(invoice) {
    const { data } = await api.get(`/invoices/${invoice.id}/receipt`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/pdf" }),
    );
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div>
      <PageHeader title="Invoice" subtitle={`${invoices.length} invoice`} />

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        {["", "UNPAID", "PAID", "PARTIAL", "VOID"].map((s) => (
          <button
            key={s || "ALL"}
            onClick={() => setStatusFilter(s)}
            className="btn"
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              border: "1px solid var(--border-strong)",
              background: statusFilter === s ? "var(--ice-400)" : "transparent",
              color:
                statusFilter === s ? "var(--navy-950)" : "var(--text-muted)",
            }}
          >
            {s === "" ? "Semua" : s}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 4 }}>
        <table>
          <thead>
            <tr>
              <th>No. Invoice</th>
              <th>Pelanggan</th>
              <th>Layanan</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-faint)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-faint)" }}>
                  Belum ada invoice.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.order?.customer?.name}</td>
                <td>{inv.order?.serviceType?.name}</td>
                <td className="mono">{formatRupiah(inv.total)}</td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost"
                    style={{
                      padding: "5px 10px",
                      fontSize: 12.5,
                      marginRight: 6,
                    }}
                    onClick={() => handleReceipt(inv)}
                  >
                    Nota PDF
                  </button>
                  {(inv.status === "UNPAID" || inv.status === "PARTIAL") && (
                    <button
                      className="btn btn-primary"
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={() => openPay(inv)}
                    >
                      Terima Bayar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title="Terima pembayaran"
        width={380}
      >
        {payTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {payTarget.invoiceNumber} — Total {formatRupiah(payTarget.total)}
            </div>
            {invoicePaid(payTarget) > 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Sudah dibayar: {formatRupiah(invoicePaid(payTarget))} · Sisa:{" "}
                {formatRupiah(payTarget.total - invoicePaid(payTarget))}
              </div>
            )}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={fullPay}
                onChange={(e) => setFullPay(e.target.checked)}
              />
              Bayar lunas sekarang
            </label>
            {!fullPay && (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                }}
              >
                Jumlah bayar / DP (Rp)
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Tunai</option>
              <option value="TRANSFER">Transfer</option>
              <option value="QRIS">QRIS</option>
              <option value="OTHER">Lainnya</option>
            </select>
            {payError && (
              <div style={{ fontSize: 12.5, color: "var(--signal-red)" }}>
                {payError}
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ justifyContent: "center" }}
              onClick={handleMarkPaid}
            >
              Konfirmasi Pembayaran
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
