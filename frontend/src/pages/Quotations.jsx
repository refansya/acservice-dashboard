import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const STATUS_FLOW = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
];
const EMPTY_FORM = {
  customerId: "",
  newCustomerName: "",
  newCustomerPhone: "",
  serviceTypeId: "",
  jobType: "",
  serviceItem: "",
  brand: "",
  address: "",
  notes: "",
  discountPercent: "0",
  validUntil: "",
  items: [],
};

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function waLink(phone) {
  return `https://wa.me/${(phone || "").replace(/\D/g, "").replace(/^0/, "62")}`;
}

const EMPTY_CONVERT_FORM = {
  technicianId: "",
  scheduledDate: "",
  helperIds: [],
  items: [],
};

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [addressOverride, setAddressOverride] = useState(false);
  const [error, setError] = useState("");
  // Form konversi ke Order - dipakai supaya order hasil konversi bisa
  // langsung diisi teknisi, jadwal, dan helper+komisi, sama seperti alur
  // "Order Baru" manual di halaman Order.
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [convertForm, setConvertForm] = useState(EMPTY_CONVERT_FORM);
  const [convertError, setConvertError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/quotations", {
      params: statusFilter ? { status: statusFilter } : {},
    });
    setQuotations(data);
    setLoading(false);
  }

  useEffect(() => {
    Promise.all([
      api.get("/customers"),
      api.get("/service-types"),
      api.get("/technicians"),
      api.get("/helpers", { params: { active: true } }),
    ]).then(([c, s, t, h]) => {
      setCustomers(c.data);
      setServiceTypes(s.data);
      setTechnicians(t.data);
      setHelpers(h.data);
    });
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setNewCustomerMode(false);
    setAddressOverride(false);
    setError("");
    setModalOpen(true);
  }

  // Sama seperti di halaman Order: pilih pelanggan lama -> alamat servis
  // otomatis terisi dari data pelanggan tersimpan. Admin tetap bisa klik
  // "Ubah alamat" kalau lokasi servis kali ini berbeda dari alamat tersimpan.
  function handleSelectCustomer(customerId) {
    const customer = customers.find((c) => c.id === customerId);
    setAddressOverride(false);
    setForm({
      ...form,
      customerId,
      address: customer?.address || "",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post("/quotations", {
        customerId: newCustomerMode ? undefined : form.customerId,
        newCustomerName: newCustomerMode ? form.newCustomerName : undefined,
        newCustomerPhone: newCustomerMode ? form.newCustomerPhone : undefined,
        serviceTypeId: form.serviceTypeId,
        jobType: form.jobType || undefined,
        serviceItem: form.serviceItem || undefined,
        brand: form.brand || undefined,
        address: form.address,
        notes: form.notes || undefined,
        discountPercent: Number(form.discountPercent || 0),
        validUntil: form.validUntil || undefined,
        items: form.items.length
          ? form.items.map((i) => ({
              ...i,
              qty: Number(i.qty),
              unitPrice: Number(i.unitPrice),
            }))
          : undefined,
      });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal membuat penawaran");
    }
  }

  async function openDetail(q) {
    const { data } = await api.get(`/quotations/${q.id}`);
    setDetail(data);
    setShowConvertForm(false);
    setConvertForm(EMPTY_CONVERT_FORM);
    setConvertError("");
  }

  async function handleStatus(status) {
    await api.patch(`/quotations/${detail.id}/status`, { status });
    const { data } = await api.get(`/quotations/${detail.id}`);
    setDetail(data);
    load();
  }

  async function handleConvert(e) {
    e.preventDefault();
    setConvertError("");
    const cleanedItems = convertForm.items
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        qty: Number(it.qty) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      }));
    try {
      await api.post(`/quotations/${detail.id}/convert`, {
        technicianId: convertForm.technicianId || undefined,
        scheduledDate: convertForm.scheduledDate || undefined,
        helperIds: convertForm.helperIds.length
          ? convertForm.helperIds
          : undefined,
        items: cleanedItems,
      });
      setDetail(null);
      setShowConvertForm(false);
      load();
    } catch (err) {
      setConvertError(
        err.response?.data?.error || "Gagal membuat order dari penawaran",
      );
    }
  }

  async function handlePdf(id) {
    const { data } = await api.get(`/quotations/${id}/pdf`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/pdf" }),
    );
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handleDelete() {
    if (!confirm(`Hapus penawaran ${detail.quotationNumber}?`)) return;
    try {
      await api.delete(`/quotations/${detail.id}`);
      setDetail(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal menghapus penawaran");
    }
  }

  const selectedCustomer = !newCustomerMode
    ? customers.find((c) => c.id === form.customerId)
    : null;
  const addressLocked =
    !newCustomerMode && Boolean(selectedCustomer?.address) && !addressOverride;

  return (
    <div>
      <PageHeader
        title="Pengajuan Penawaran"
        subtitle={`${quotations.length} penawaran`}
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            + Penawaran Baru
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
              <th>No. Penawaran</th>
              <th>Pelanggan</th>
              <th>Layanan</th>
              <th>Total</th>
              <th>Status</th>
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
            {!loading && quotations.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--text-faint)" }}>
                  Belum ada penawaran.
                </td>
              </tr>
            )}
            {quotations.map((q) => (
              <tr
                key={q.id}
                style={{ cursor: "pointer" }}
                onClick={() => openDetail(q)}
              >
                <td className="mono">{q.quotationNumber}</td>
                <td>{q.customer?.name}</td>
                <td>{q.serviceType?.name}</td>
                <td className="mono">{formatRupiah(q.total)}</td>
                <td>
                  <StatusBadge status={q.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal buat penawaran */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Penawaran Baru"
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
                  onClick={() => {
                    setNewCustomerMode(false);
                    setAddressOverride(false);
                    setForm({ ...form, address: "" });
                  }}
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
                onChange={(e) => handleSelectCustomer(e.target.value)}
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
                onClick={() => {
                  setNewCustomerMode(true);
                  setAddressOverride(false);
                  setForm({ ...form, address: "" });
                }}
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
            value={form.jobType}
            onChange={(e) => setForm({ ...form, jobType: e.target.value })}
          >
            <option value="">Jenis pekerjaan (opsional)</option>
            <option value="INSTALASI">Instalasi</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="SERVICE">Service / Repair</option>
          </select>

          {/* Alamat servis - otomatis terisi & terkunci kalau pelanggan lama
              sudah punya alamat tersimpan, tapi tetap bisa diubah manual
              lewat tombol di bawah kalau lokasi kali ini berbeda. */}
          <div>
            <input
              placeholder="Alamat servis"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              readOnly={addressLocked}
              style={
                addressLocked
                  ? { color: "var(--text-muted)", cursor: "not-allowed" }
                  : undefined
              }
              required
            />
            {addressLocked && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "3px 10px", fontSize: 12, marginTop: 6 }}
                onClick={() => setAddressOverride(true)}
              >
                Alamat servis beda dari alamat pelanggan? Ubah di sini
              </button>
            )}
          </div>

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
              placeholder="Merk"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <label
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Sparepart / item tambahan (opsional)
            </label>
            {form.items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 72px auto",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  placeholder="Nama item"
                  value={item.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      items: form.items.map((v, i) =>
                        i === index ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      items: form.items.map((v, i) =>
                        i === index ? { ...v, qty: e.target.value } : v,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setForm({
                      ...form,
                      items: form.items.filter((_, i) => i !== index),
                    })
                  }
                >
                  ×
                </button>
                <input
                  type="number"
                  min="0"
                  placeholder="Harga"
                  style={{ gridColumn: "1 / -1" }}
                  value={item.unitPrice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      items: form.items.map((v, i) =>
                        i === index ? { ...v, unitPrice: e.target.value } : v,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12.5 }}
              onClick={() =>
                setForm({
                  ...form,
                  items: [...form.items, { name: "", qty: 1, unitPrice: "" }],
                })
              }
            >
              + Tambah Item
            </button>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Diskon (%) — dari harga jasa
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.discountPercent}
                onChange={(e) =>
                  setForm({ ...form, discountPercent: e.target.value })
                }
                style={{ marginTop: 4 }}
              />
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--text-faint)",
                  marginTop: 3,
                }}
              >
                Dihitung dari harga jasa saja, sparepart/item tambahan tidak
                ikut didiskon.
              </span>
            </label>
            <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Berlaku sampai (opsional)
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) =>
                  setForm({ ...form, validUntil: e.target.value })
                }
                style={{ marginTop: 4 }}
              />
            </label>
          </div>

          <textarea
            placeholder="Catatan (opsional)"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            Buat Penawaran
          </button>
        </form>
      </Modal>

      {/* Modal detail */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.quotationNumber}
        width={480}
      >
        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {detail.customer?.name} — {detail.customer?.phone}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {detail.address}
              </div>
            </div>

            <a
              className="btn btn-ghost"
              href={waLink(detail.customer?.phone)}
              target="_blank"
              rel="noreferrer"
              style={{ alignSelf: "flex-start" }}
            >
              WhatsApp Pelanggan
            </a>

            <div>
              <StatusBadge status={detail.status} />
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {detail.serviceType?.name}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              Total: {formatRupiah(detail.total)}
              {Number(detail.discountPercent) > 0 && (
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    fontWeight: 400,
                    marginLeft: 8,
                  }}
                >
                  (diskon {Number(detail.discountPercent)}%)
                </span>
              )}
            </div>

            {detail.status === "DRAFT" && (
              <button
                className="btn btn-primary"
                onClick={() => handleStatus("SENT")}
              >
                Tandai Terkirim ke Pelanggan
              </button>
            )}
            {detail.status === "SENT" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => handleStatus("APPROVED")}
                >
                  Disetujui
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => handleStatus("REJECTED")}
                >
                  Ditolak
                </button>
              </div>
            )}
            {detail.status === "APPROVED" && !showConvertForm && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConvertForm({
                    ...EMPTY_CONVERT_FORM,
                    items: detail.items?.length
                      ? detail.items.map((it) => ({
                          name: it.name,
                          qty: it.qty,
                          unitPrice: it.unitPrice,
                        }))
                      : [],
                  });
                  setShowConvertForm(true);
                }}
              >
                Jadikan Order
              </button>
            )}
            {detail.status === "APPROVED" && showConvertForm && (
              <form
                onSubmit={handleConvert}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "var(--navy-950)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Sama seperti membuat order baru manual - teknisi, jadwal, dan
                  helper di sini opsional dan bisa diisi/diubah lagi nanti dari
                  halaman Order.
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Sparepart / item — diisi otomatis dari penawaran, boleh
                    diubah/ditambah
                  </label>
                  {convertForm.items.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 72px auto",
                        gridTemplateRows: "auto auto",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        placeholder="Nama item"
                        value={item.name}
                        onChange={(e) =>
                          setConvertForm({
                            ...convertForm,
                            items: convertForm.items.map((v, i) =>
                              i === index ? { ...v, name: e.target.value } : v,
                            ),
                          })
                        }
                        style={{ gridColumn: "1", gridRow: "1" }}
                      />
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={(e) =>
                          setConvertForm({
                            ...convertForm,
                            items: convertForm.items.map((v, i) =>
                              i === index ? { ...v, qty: e.target.value } : v,
                            ),
                          })
                        }
                        style={{ gridColumn: "2", gridRow: "1" }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          setConvertForm({
                            ...convertForm,
                            items: convertForm.items.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                        style={{ gridColumn: "3", gridRow: "1" }}
                      >
                        ×
                      </button>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="Harga"
                        value={item.unitPrice}
                        onChange={(e) =>
                          setConvertForm({
                            ...convertForm,
                            items: convertForm.items.map((v, i) =>
                              i === index
                                ? { ...v, unitPrice: e.target.value }
                                : v,
                            ),
                          })
                        }
                        style={{ gridColumn: "1 / -1", gridRow: "2" }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12.5 }}
                    onClick={() =>
                      setConvertForm({
                        ...convertForm,
                        items: [
                          ...convertForm.items,
                          { name: "", qty: 1, unitPrice: "" },
                        ],
                      })
                    }
                  >
                    + Tambah Item
                  </button>
                </div>
                <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Teknisi (opsional)
                  <select
                    value={convertForm.technicianId}
                    onChange={(e) =>
                      setConvertForm({
                        ...convertForm,
                        technicianId: e.target.value,
                      })
                    }
                    style={{ marginTop: 4 }}
                  >
                    <option value="">Belum ditugaskan</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  Tanggal terjadwal (opsional)
                  <input
                    type="date"
                    value={convertForm.scheduledDate}
                    onChange={(e) =>
                      setConvertForm({
                        ...convertForm,
                        scheduledDate: e.target.value,
                      })
                    }
                    style={{ marginTop: 4 }}
                  />
                </label>
                {helpers.length > 0 && (
                  <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    Helper (opsional, boleh lebih dari satu — komisi dibagi rata
                    sesuai rate layanan)
                    <select
                      multiple
                      value={convertForm.helperIds}
                      onChange={(e) =>
                        setConvertForm({
                          ...convertForm,
                          helperIds: Array.from(
                            e.target.selectedOptions,
                            (o) => o.value,
                          ),
                        })
                      }
                      style={{ marginTop: 4, minHeight: 78 }}
                    >
                      {helpers.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} — {h.phone}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {convertError && (
                  <div style={{ color: "var(--signal-red)", fontSize: 13 }}>
                    {convertError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => {
                      setShowConvertForm(false);
                      setConvertError("");
                    }}
                  >
                    Batal
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Konversi ke Order
                  </button>
                </div>
              </form>
            )}
            {detail.status === "CONVERTED" && detail.convertedOrder && (
              <div style={{ fontSize: 13, color: "var(--success)" }}>
                Sudah jadi order:{" "}
                <span className="mono">
                  {detail.convertedOrder.orderNumber}
                </span>
              </div>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => handlePdf(detail.id)}
            >
              Unduh PDF Penawaran
            </button>

            {detail.status !== "CONVERTED" && (
              <button
                className="btn btn-danger"
                style={{ marginTop: 8 }}
                onClick={handleDelete}
              >
                Hapus Penawaran
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
