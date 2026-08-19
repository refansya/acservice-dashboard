import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
const EMPTY = { name: "", phone: "", isActive: true };
export default function Helpers() {
  const [items, setItems] = useState([]), [form, setForm] = useState(EMPTY), [open, setOpen] = useState(false), [account, setAccount] = useState(null), [credentials, setCredentials] = useState({ email: "", password: "" });
  const load = async () => setItems((await api.get("/helpers")).data);
  useEffect(() => { load(); }, []);
  const save = async (e) => { e.preventDefault(); await api.post("/helpers", form); setOpen(false); setForm(EMPTY); load(); };
  const makeAccount = async (e) => { e.preventDefault(); await api.post(`/helpers/${account.id}/account`, credentials); setAccount(null); setCredentials({ email: "", password: "" }); load(); };
  return <div><PageHeader title="Helper" subtitle={`${items.length} helper terdaftar`} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>+ Helper Baru</button>} />
    <div className="card" style={{ padding: 4 }}><table><thead><tr><th>Nama</th><th>Telepon</th><th>Penugasan</th><th>Akun</th><th></th></tr></thead><tbody>{items.map((h) => <tr key={h.id}><td>{h.name}</td><td className="mono">{h.phone}</td><td>{h._count.assignments} order</td><td>{h.account?.email || "Belum dibuat"}</td><td style={{ textAlign: "right" }}>{!h.account && <button className="btn btn-ghost" onClick={() => setAccount(h)}>Buat Akun</button>}</td></tr>)}{!items.length && <tr><td colSpan={5}>Belum ada helper.</td></tr>}</tbody></table></div>
    <Modal open={open} onClose={() => setOpen(false)} title="Helper Baru"><form onSubmit={save} style={{ display:"flex", flexDirection:"column", gap:12 }}><input placeholder="Nama helper" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /><input placeholder="Nomor telepon" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required /><button className="btn btn-primary">Simpan</button></form></Modal>
    <Modal open={!!account} onClose={() => setAccount(null)} title={`Akun Helper — ${account?.name}`}><form onSubmit={makeAccount} style={{ display:"flex", flexDirection:"column", gap:12 }}><input type="email" placeholder="Email" value={credentials.email} onChange={e=>setCredentials({...credentials,email:e.target.value})} required /><input type="password" minLength="6" placeholder="Password" value={credentials.password} onChange={e=>setCredentials({...credentials,password:e.target.value})} required /><button className="btn btn-primary">Buat Akun</button></form></Modal>
  </div>;
}
