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

export default function Kasir() {
  const [readyOrders, setReadyOrders] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null); // { kind: "order" | "invoice", data }
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [fullPay, setFullPay] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const [orders, invoices] = await Promise.all([
      api.get("/orders", { params: { status: "DONE" } }),
      api.get("/invoices", { params: { status: "UNPAID,PARTIAL" } }),
    ]);
    setReadyOrders(orders.data);
    setOpenInvoices(invoices.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function orderTotal(order) {
    const itemsTotal =
      order.items?.reduce((sum, i) => sum + Number(i.unitPrice) * i.qty, 0) ||
      0;
    const serviceCost =
      order.jobCost != null
        ? Number(order.jobCost)
        : Number(order.serviceType?.basePrice || 0);
    return serviceCost + itemsTotal - ((serviceCost + itemsTotal) * Number(discountPercent || 0) / 100);
  }

  function invoicePaid(inv) {
    return (inv.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  }

  function openOrder(order) {
    setTarget({ kind: "order", data: order });
    setDiscountPercent("0");
    setFullPay(true);
    setMethod("CASH");
    setAmount("");
    setError("");
  }

  function openInvoice(inv) {
    const remaining = Number(inv.total) - invoicePaid(inv);
    setTarget({ kind: "invoice", data: inv });
    setFullPay(true);
    setMethod("CASH");
    setAmount(String(remaining));
    setError("");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      if (target.kind === "order") {
        const total = orderTotal(target.data);
        const payAmount = fullPay ? total : Number(amount || 0);
        await api.post(`/orders/${target.data.id}/checkout`, {
          discountPercent: Number(discountPercent || 0),
          payment: payAmount > 0 ? { amount: payAmount, method } : undefined,
        });
      } else {
        const remaining = Number(target.data.total) - invoicePaid(target.data);
        const payAmount = fullPay ? remaining : Number(amount || 0);
        await api.post(`/invoices/${target.data.id}/payments`, {
          amount: payAmount,
          method,
        });
      }
      setTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memproses pembayaran");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReceipt(invoiceId) {
    const { data } = await api.get(`/invoices/${invoiceId}/receipt`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/pdf" }),
    );
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const remainingAfterOrderDiscount =
    target?.kind === "order" ? orderTotal(target.data) : 0;
  const invoiceRemaining =
    target?.kind === "invoice"
      ? Number(target.data.total) - invoicePaid(target.data)
      : 0;

  return (
    <div>
      <PageHeader
        title="Kasir"
        subtitle="Checkout order selesai dan terima pembayaran"
      />

      <h3 style={{ fontSize: 14, marginBottom: 10 }}>
        Siap checkout ({readyOrders.length})
      </h3>
      <div className="card" style={{ padding: 4, marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>No. Order</th>
              <th>Pelanggan</th>
              <th>Layanan</th>
              <th>Estimasi Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-faint)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && readyOrders.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-faint)" }}>
                  Tidak ada order yang siap checkout.
                </td>
              </tr>
            )}
            {readyOrders.map((o) => {
              const itemsTotal =
                o.items?.reduce(
                  (sum, i) => sum + Number(i.unitPrice) * i.qty,
                  0,
                ) || 0;
              const serviceCost =
                o.jobCost != null
                  ? Number(o.jobCost)
                  : Number(o.serviceType?.basePrice || 0);
              return (
                <tr key={o.id}>
                  <td className="mono">{o.orderNumber}</td>
                  <td>{o.customer?.name}</td>
                  <td>{o.serviceType?.name}</td>
                  <td className="mono">
                    {formatRupiah(serviceCost + itemsTotal)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={() => openOrder(o)}
                    >
                      Checkout
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 10 }}>
        Belum lunas ({openInvoices.length})
      </h3>
      <div className="card" style={{ padding: 4 }}>
        <table>
          <thead>
            <tr>
              <th>No. Invoice</th>
              <th>Pelanggan</th>
              <th>Total</th>
              <th>Sisa</th>
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
            {!loading && openInvoices.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--text-faint)" }}>
                  Tidak ada tagihan terbuka.
                </td>
              </tr>
            )}
            {openInvoices.map((inv) => (
              <tr key={inv.id}>
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.order?.customer?.name}</td>
                <td className="mono">{formatRupiah(inv.total)}</td>
                <td className="mono">
                  {formatRupiah(Number(inv.total) - invoicePaid(inv))}
                </td>
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
                    onClick={() => handleReceipt(inv.id)}
                  >
                    Nota PDF
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "5px 10px", fontSize: 12.5 }}
                    onClick={() => openInvoice(inv)}
                  >
                    Terima Bayar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={
          target?.kind === "order" ? "Checkout order" : "Terima pembayaran"
        }
        width={400}
      >
        {target && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {target.kind === "order"
                ? target.data.orderNumber
                : target.data.invoiceNumber}{" "}
              —{" "}
              {target.kind === "order"
                ? target.data.customer?.name
                : target.data.order?.customer?.name}
            </div>

            {target.kind === "order" && (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                }}
              >
                Diskon (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </label>
            )}

            <div style={{ fontSize: 15, fontWeight: 500 }}>
              Total:{" "}
              {formatRupiah(
                target.kind === "order"
                  ? remainingAfterOrderDiscount
                  : Number(target.data.total),
              )}
            </div>
            {target.kind === "invoice" && invoicePaid(target.data) > 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Sudah dibayar: {formatRupiah(invoicePaid(target.data))} · Sisa:{" "}
                {formatRupiah(invoiceRemaining)}
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

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 12.5,
                color: "var(--text-muted)",
              }}
            >
              Metode pembayaran
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer</option>
                <option value="QRIS">QRIS</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </label>

            {error && (
              <div style={{ fontSize: 12.5, color: "var(--signal-red)" }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ justifyContent: "center" }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? "Memproses..."
                : target.kind === "order"
                  ? "Buat Nota & Terima Bayar"
                  : "Konfirmasi Pembayaran"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
