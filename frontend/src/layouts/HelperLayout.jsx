import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function HelperLayout() { const { user, logout } = useAuth(); return <main style={{ maxWidth:960, margin:"0 auto", padding:28 }}><div style={{display:"flex",justifyContent:"space-between",marginBottom:28}}><div><b>project.id Services</b><div style={{fontSize:12,color:"var(--text-muted)"}}>PORTAL HELPER</div></div><div>{user?.name} <button className="btn btn-ghost" onClick={logout}>Keluar</button></div></div><Outlet /></main>; }
