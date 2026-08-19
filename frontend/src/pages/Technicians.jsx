import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const EMPTY = { name: "", phone: "", specialty: [], status: "AVAILABLE" };
const EMPTY_ACCOUNT = { email: "", password: "" };

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [accountTarget, setAccountTarget] = useState(null);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/technicians");
    setTechnicians(data);
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

  function openEdit(t) {
    setForm({ name: t.name, phone: t.phone, specialty: t.specialty, status: t.status });
    setEditingId(t.id);
    setError("");
    setModalOpen(true);
  }

  function toggleSpecialty(value) {
    setForm((f) => ({
      ...f,
      specialty: f.specialty.includes(value) ? f.specialty.filter((s) => s !== value) : [...f.specialty, value],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.specialty.length === 0) {
      setError("Pilih minimal satu spesialisasi");
      return;
    }
    try {
      if (editingId) {
        await api.patch(`/technicians/${editingId}`, form);
      } else {
        await api.post("/technicians", form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan data");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus teknisi ini?")) return;
    await api.delete(`/technicians/${id}`);
    load();
  }

  function openAccount(t) {
    setAccountTarget(t);
    setAccountForm(EMPTY_ACCOUNT);
    setAccountError("");
    setAccountSuccess("");
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setAccountError("");
    try {
      await api.post(`/technicians/${accountTarget.id}/account`, accountForm);
      setAccountSuccess(`Akun login dibuat: ${accountForm.email}`);
    } catch (err) {
      setAccountError(err.response?.data?.error || "Gagal membuat akun. Mungkin teknisi ini sudah punya akun.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Teknisi"
        subtitle={`${technicians.length} teknisi terdaftar`}
        action={<button className="btn btn-primary" onClick={openCreate}>+ Teknisi Baru</button>}
      />

      <div className="card" style={{ padding: 4 }}>
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Telepon</th>
              <th>Spesialisasi</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ color: "var(--text-faint)" }}>Memuat...</td></tr>
            )}
            {!loading && technicians.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--text-faint)" }}>Belum ada teknisi.</td></tr>
            )}
            {technicians.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="mono">{t.phone}</td>
                <td style={{ display: "flex", gap: 6, paddingTop: 12 }}>
                  {t.specialty.map((s) => <StatusBadge key={s} status={s} />)}
                </td>
                <td><StatusBadge status={t.status} /></td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5, marginRight: 6 }} onClick={() => openAccount(t)}>Buat Akun</button>
                  <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5, marginRight: 6 }} onClick={() => openEdit(t)}>Ubah</button>
                  <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleDelete(t.id)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Ubah Teknisi" : "Teknisi Baru"}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Nomor telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />

          <div>
            <label style={{ fontSize: 12.5, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Spesialisasi</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["AC", "ELEKTRONIK"].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSpecialty(s)}
                  className="btn"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    border: "1px solid var(--border-strong)",
                    background: form.specialty.includes(s) ? "var(--ice-400)" : "transparent",
                    color: form.specialty.includes(s) ? "var(--navy-950)" : "var(--text-primary)",
                  }}
                >
                  {s === "AC" ? "AC" : "Elektronik"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="AVAILABLE">Tersedia</option>
              <option value="ON_DUTY">Bertugas</option>
              <option value="OFF">Nonaktif</option>
            </select>
          </div>

          {error && <div style={{ color: "var(--signal-red)", fontSize: 13 }}>{error}</div>}
          <button className="btn btn-primary" style={{ justifyContent: "center" }}>Simpan</button>
        </form>
      </Modal>

      <Modal open={!!accountTarget} onClose={() => setAccountTarget(null)} title={`Buat Akun Login — ${accountTarget?.name}`} width={380}>
        <form onSubmit={handleCreateAccount} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="email" placeholder="Email login" value={accountForm.email} onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })} required />
          <input type="password" placeholder="Password (min 6 karakter)" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} minLength={6} required />
          {accountError && <div style={{ color: "var(--signal-red)", fontSize: 13 }}>{accountError}</div>}
          {accountSuccess && <div style={{ color: "var(--success)", fontSize: 13 }}>{accountSuccess}</div>}
          <button className="btn btn-primary" style={{ justifyContent: "center" }}>Buat Akun</button>
        </form>
      </Modal>
    </div>
  );
}
