import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";

const EMPTY = { name: "", phone: "", address: "", notes: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/customers", { params: search ? { search } : {} });
    setCustomers(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    setModalOpen(true);
  }

  function openEdit(customer) {
    setForm({ name: customer.name, phone: customer.phone, address: customer.address || "", notes: customer.notes || "" });
    setEditingId(customer.id);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/customers/${editingId}`, form);
      } else {
        await api.post("/customers", form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan data");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus pelanggan ini?")) return;
    await api.delete(`/customers/${id}`);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Pelanggan"
        subtitle={`${customers.length} pelanggan terdaftar`}
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            + Pelanggan Baru
          </button>
        }
      />

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <input
          placeholder="Cari nama atau nomor telepon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>

      <div className="card" style={{ padding: 4 }}>
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Telepon</th>
              <th>Alamat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} style={{ color: "var(--text-faint)" }}>Memuat...</td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--text-faint)" }}>Belum ada pelanggan.</td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="mono">{c.phone}</td>
                <td style={{ color: "var(--text-muted)" }}>{c.address || "—"}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5, marginRight: 6 }} onClick={() => openEdit(c)}>
                    Ubah
                  </button>
                  <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleDelete(c.id)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Ubah Pelanggan" : "Pelanggan Baru"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Nomor telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <input placeholder="Alamat" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea placeholder="Catatan" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <div style={{ color: "var(--signal-red)", fontSize: 13 }}>{error}</div>}
          <button className="btn btn-primary" style={{ justifyContent: "center" }}>Simpan</button>
        </form>
      </Modal>
    </div>
  );
}
