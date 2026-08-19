import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const STATUS_FLOW = ["PENDING", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELLED"];
const EMPTY_FORM = {
  customerId: "",
  newCustomerName: "",
  newCustomerPhone: "",
  serviceTypeId: "",
  technicianId: "",
  address: "",
  complaint: "",
  scheduledDate: "",
  serviceItem: "",
  brand: "",
  reminderDate: "",
  helperIds: [],
  items: [],
  proofPhotoUrl: "",
};

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [error, setError] = useState("");

  async function loadOrders() {
    setLoading(true);
    const { data } = await api.get("/orders", {
      params: statusFilter ? { status: statusFilter } : {},
    });
    setOrders(data);
    setLoading(false);
  }

  async function loadRefs() {
    const [c, t, s, h] = await Promise.all([
      api.get("/customers"),
      api.get("/technicians"),
      api.get("/service-types"),
      api.get("/helpers", { params: { active: true } }),
    ]);
    setCustomers(c.data);
    setTechnicians(t.data);
    setServiceTypes(s.data);
    setHelpers(h.data);
  }

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setNewCustomerMode(false);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        customerId: newCustomerMode ? undefined : form.customerId,
        newCustomerName: newCustomerMode ? form.newCustomerName : undefined,
        newCustomerPhone: newCustomerMode ? form.newCustomerPhone : undefined,
        serviceTypeId: form.serviceTypeId,
        technicianId: form.technicianId || undefined,
        address: form.address,
        complaint: form.complaint || undefined,
        scheduledDate: form.scheduledDate || undefined,
        serviceItem: form.serviceItem || undefined,
        brand: form.brand || undefined,
        reminderDate: form.reminderDate || undefined,
        helperIds: form.helperIds.length ? form.helperIds : undefined,
        items: form.items.length ? form.items.map((item) => ({ ...item, qty: Number(item.qty), unitPrice: Number(item.unitPrice) })) : undefined,
        proofPhotoUrl: form.proofPhotoUrl || undefined,
      };
      await api.post("/orders", payload);
      setModalOpen(false);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal membuat order");
    }
  }

  async function openDetail(order) {
    const { data } = await api.get(`/orders/${order.id}`);
    setDetailOrder(data);
  }

  async function handleAssign(technicianId) {
    await api.patch(`/orders/${detailOrder.id}/assign`, { technicianId });
    const { data } = await api.get(`/orders/${detailOrder.id}`);
    setDetailOrder(data);
    loadOrders();
  }

  async function handleStatus(status) {
    await api.patch(`/orders/${detailOrder.id}/status`, { status });
    const { data } = await api.get(`/orders/${detailOrder.id}`);
    setDetailOrder(data);
    loadOrders();
  }

  async function handleCreateInvoice() {
    try {
      await api.post(`/invoices/from-order/${detailOrder.id}`);
      const { data } = await api.get(`/orders/${detailOrder.id}`);
      setDetailOrder(data);
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal membuat invoice");
    }
  }

  return (
    <div>
      <PageHeader
        title="Order Servis"
        subtitle={`${orders.length} order`}
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            + Order Baru
          </button>
        }
      />

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        {["", ...STATUS_FLOW].map((s) => (
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
              <th>No. Order</th>
              <th>Pelanggan</th>
              <th>Layanan</th>
              <th>Item / Merk</th>
              <th>Teknisi</th>
              <th>Jadwal / Reminder</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-faint)" }}>
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-faint)" }}>
                  Belum ada order.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.id}
                style={{ cursor: "pointer" }}
                onClick={() => openDetail(o)}
              >
                <td className="mono">{o.orderNumber}</td>
                <td>{o.customer?.name}</td>
                <td>
                  <span className="mono" style={{ color: "var(--text-muted)" }}>
                    {o.serviceType?.code}
                  </span>{" "}
                  {o.serviceType?.name}
                </td>
                <td>
                  {[o.serviceItem, o.brand].filter(Boolean).join(" / ") || "—"}
                </td>
                <td style={{ color: "var(--text-muted)" }}>
                  {o.technician?.name || "Belum ditugaskan"}
                </td>
                <td className="mono" style={{ fontSize: 11 }}>
                  {o.scheduledDate
                    ? new Date(o.scheduledDate).toLocaleDateString("id-ID")
                    : "—"}
                  {o.reminderDate && (
                    <>
                      <br />
                      <span style={{ color: "var(--signal-red)" }}>
                        Ulang:{" "}
                        {new Date(o.reminderDate).toLocaleDateString("id-ID")}
                      </span>
                    </>
                  )}
                </td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal buat order baru */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Order Baru"
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {newCustomerMode ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "var(--navy-950)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Pelanggan baru
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "3px 10px", fontSize: 12 }}
                  onClick={() => setNewCustomerMode(false)}
                >
                  Pilih dari daftar
                </button>
              </div>
              <input
                placeholder="Nama pelanggan"
                value={form.newCustomerName}
                onChange={(e) =>
                  setForm({ ...form, newCustomerName: e.target.value })
                }
                required
              />
              <input
                placeholder="Nomor WhatsApp"
                value={form.newCustomerPhone}
                onChange={(e) =>
                  setForm({ ...form, newCustomerPhone: e.target.value })
                }
                required
              />
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
                required
                style={{ flex: 1 }}
              >
                <option value="">Pilih pelanggan</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setNewCustomerMode(true)}
              >
                + Baru
              </button>
            </div>
          )}

          <select
            value={form.serviceTypeId}
            onChange={(e) =>
              setForm({ ...form, serviceTypeId: e.target.value })
            }
            required
          >
            <option value="">Pilih jenis layanan</option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name} ({formatRupiah(s.basePrice)})
              </option>
            ))}
          </select>

          <select
            value={form.technicianId}
            onChange={(e) => setForm({ ...form, technicianId: e.target.value })}
          >
            <option value="">Belum tugaskan teknisi (opsional)</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Alamat servis"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <input
              placeholder="Item layanan (mis. AC 0.5 PK)"
              value={form.serviceItem}
              onChange={(e) =>
                setForm({ ...form, serviceItem: e.target.value })
              }
            />
            <input
              placeholder="Merk (mis. Panasonic)"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>
          {helpers.length > 0 && (
            <div>
              <label
                style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Helper terdaftar (opsional, boleh lebih dari satu)
              </label>
              <select
                multiple
                value={form.helperIds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    helperIds: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
                style={{ minHeight: 78 }}
              >
                {helpers.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} — {h.phone}
                  </option>
                ))}
              </select>
            </div>
          )}
          <textarea
            placeholder="Keluhan pelanggan"
            rows={2}
            value={form.complaint}
            onChange={(e) => setForm({ ...form, complaint: e.target.value })}
          />
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <label style={{ fontSize: 12.5, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>Sparepart / item awal (opsional)</label>
            {form.items.map((item, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 72px 120px auto", gap: 8, marginBottom: 8 }}><input placeholder="Nama item" value={item.name} onChange={(e) => setForm({ ...form, items: form.items.map((v, i) => i === index ? { ...v, name: e.target.value } : v) })} /><input type="number" min="1" inputMode="numeric" placeholder="Qty" value={item.qty} onChange={(e) => setForm({ ...form, items: form.items.map((v, i) => i === index ? { ...v, qty: e.target.value } : v) })} /><input type="number" min="0" inputMode="numeric" placeholder="Harga" value={item.unitPrice} onChange={(e) => setForm({ ...form, items: form.items.map((v, i) => i === index ? { ...v, unitPrice: e.target.value } : v) })} /><button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}>×</button></div>)}
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setForm({ ...form, items: [...form.items, { name: "", qty: 1, unitPrice: "" }] })}>+ Tambah Item</button>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Tanggal terjadwal (opsional)
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) =>
                  setForm({ ...form, scheduledDate: e.target.value })
                }
                style={{ marginTop: 4 }}
              />
            </label>
            <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Tanggal reminder (opsional)
              <input
                type="date"
                value={form.reminderDate}
                onChange={(e) =>
                  setForm({ ...form, reminderDate: e.target.value })
                }
                style={{ marginTop: 4 }}
              />
            </label>
          </div>
          <input
            type="url"
            placeholder="URL foto bukti (opsional)"
            value={form.proofPhotoUrl}
            onChange={(e) =>
              setForm({ ...form, proofPhotoUrl: e.target.value })
            }
          />

          {error && (
            <div style={{ color: "var(--signal-red)", fontSize: 13 }}>
              {error}
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ justifyContent: "center" }}
          >
            Buat Order
          </button>
        </form>
      </Modal>

      {/* Modal detail order */}
      <Modal
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={detailOrder?.orderNumber}
        width={520}
      >
        {detailOrder && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {detailOrder.customer?.name} — {detailOrder.customer?.phone}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {detailOrder.address}
              </div>
              {detailOrder.complaint && (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Keluhan: {detailOrder.complaint}
                </div>
              )}
              {(detailOrder.serviceItem || detailOrder.brand) && (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Unit:{" "}
                  {[detailOrder.serviceItem, detailOrder.brand]
                    .filter(Boolean)
                    .join(" — ")}
                </div>
              )}
              {detailOrder.reminderDate && (
                <div
                  style={{
                    fontSize: 13,
                    marginTop: 6,
                    color: "var(--signal-red)",
                  }}
                >
                  Reminder:{" "}
                  {new Date(detailOrder.reminderDate).toLocaleDateString(
                    "id-ID",
                  )}
                </div>
              )}
            </div>

            <div>
              <StatusBadge status={detailOrder.status} />
              <span
                style={{
                  marginLeft: 8,
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {detailOrder.serviceType?.name}
              </span>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Teknisi
              </label>
              <select
                value={detailOrder.technicianId || ""}
                onChange={(e) => handleAssign(e.target.value)}
              >
                <option value="">Belum ditugaskan</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Ubah status
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    className="btn btn-ghost"
                    style={{
                      padding: "5px 10px",
                      fontSize: 12,
                      opacity: detailOrder.status === s ? 0.4 : 1,
                    }}
                    disabled={detailOrder.status === s}
                    onClick={() => handleStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {detailOrder.items?.length > 0 && (
              <div>
                <label
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Sparepart / item
                </label>
                {detailOrder.items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "4px 0",
                    }}
                  >
                    <span>
                      {it.name} × {it.qty}
                    </span>
                    <span className="mono">
                      {formatRupiah(it.unitPrice * it.qty)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {detailOrder.helpers?.length > 0 && (
              <div style={{ fontSize: 13 }}>
                <label style={{ color: "var(--text-muted)" }}>Helper</label>
                {detailOrder.helpers.map((h) => (
                  <div key={h.id}>
                    {h.name} — {Number(h.commissionRate)}% (
                    {formatRupiah(h.commissionAmount)})
                  </div>
                ))}
              </div>
            )}
            {detailOrder.photos?.length > 0 && (
              <a
                href={detailOrder.photos[0].url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13 }}
              >
                Lihat foto bukti
              </a>
            )}

            <div
              style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}
            >
              {detailOrder.invoice ? (
                <div style={{ fontSize: 13, color: "var(--success)" }}>
                  Invoice {detailOrder.invoice.invoiceNumber} —{" "}
                  {formatRupiah(detailOrder.invoice.total)} (
                  {detailOrder.invoice.status})
                </div>
              ) : detailOrder.status === "DONE" ? (
                <button
                  className="btn btn-primary"
                  onClick={handleCreateInvoice}
                >
                  Buat Invoice
                </button>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                  Invoice bisa dibuat setelah order berstatus DONE.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
