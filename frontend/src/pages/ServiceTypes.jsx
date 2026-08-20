import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const EMPTY = {
  code: "",
  name: "",
  category: "AC",
  basePrice: "",
  helperRate: "0",
  description: "",
};

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function ServiceTypes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    // includeInactive=true supaya halaman manajemen ini tetap menampilkan
    // layanan yang sudah dinonaktifkan (perlu terlihat agar bisa diaktifkan lagi).
    // Endpoint lain (form buat order, dsb) TIDAK mengirim param ini, jadi otomatis
    // hanya dapat layanan yang aktif.
    const { data } = await api.get("/service-types", {
      params: { includeInactive: true },
    });
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    setModalOpen(true);
  }

  function openEdit(s) {
    setForm({
      code: s.code,
      name: s.name,
      category: s.category,
      basePrice: s.basePrice,
      helperRate: s.helperRate ?? "0",
      description: s.description || "",
    });
    setEditingId(s.id);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        basePrice: Number(form.basePrice),
        helperRate: Number(form.helperRate),
      };
      if (editingId) {
        await api.patch(`/service-types/${editingId}`, payload);
      } else {
        await api.post("/service-types", payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan data");
    }
  }

  async function handleDeactivate(id) {
    if (
      !confirm(
        "Nonaktifkan jenis layanan ini? Layanan ini tidak akan muncul lagi di pilihan saat membuat order baru.",
      )
    )
      return;
    await api.delete(`/service-types/${id}`);
    load();
  }

  async function handleActivate(id) {
    await api.patch(`/service-types/${id}`, { isActive: true });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Jenis Layanan"
        subtitle="Kode layanan, harga jasa, dan komisi helper"
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            + Layanan Baru
          </button>
        }
      />

      <div className="card" style={{ padding: 4 }}>
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Layanan</th>
              <th>Kategori</th>
              <th>Harga Dasar</th>
              <th>Komisi Helper</th>
              <th>Status</th>
              <th></th>
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
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: "var(--text-faint)" }}>
                  Belum ada layanan.
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr key={s.id} style={{ opacity: s.isActive ? 1 : 0.55 }}>
                <td className="mono">{s.code}</td>
                <td>{s.name}</td>
                <td>
                  <StatusBadge status={s.category} />
                </td>
                <td className="mono">{formatRupiah(s.basePrice)}</td>
                <td className="mono">
                  {s.helperRate}% (
                  {formatRupiah(
                    (Number(s.basePrice) * Number(s.helperRate)) / 100,
                  )}
                  )
                </td>
                <td>
                  <StatusBadge status={s.isActive ? "ACTIVE" : "INACTIVE"} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost"
                    style={{
                      padding: "5px 10px",
                      fontSize: 12.5,
                      marginRight: 6,
                    }}
                    onClick={() => openEdit(s)}
                  >
                    Ubah
                  </button>
                  {s.isActive ? (
                    <button
                      className="btn btn-danger"
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={() => handleDeactivate(s.id)}
                    >
                      Nonaktifkan
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={() => handleActivate(s.id)}
                    >
                      Aktifkan
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Ubah Layanan" : "Layanan Baru"}
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            placeholder="Kode layanan (mis. MNT)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
          <input
            placeholder="Nama layanan"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="AC">AC</option>
            <option value="ELEKTRONIK">Elektronik</option>
          </select>
          <input
            type="number"
            placeholder="Harga dasar (Rp)"
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            required
          />
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Persentase helper (%)"
            value={form.helperRate}
            onChange={(e) => setForm({ ...form, helperRate: e.target.value })}
            required
          />
          <textarea
            placeholder="Deskripsi"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            Simpan
          </button>
        </form>
      </Modal>
    </div>
  );
}
