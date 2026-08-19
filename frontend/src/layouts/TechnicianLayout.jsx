import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function TechnicianLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        className="technician-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--navy-900)",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>
            project<span style={{ color: "var(--signal-red)" }}>.id</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>
            PORTAL TEKNISI — {user?.name}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={handleLogout}>
          Keluar
        </button>
      </header>

      <main className="technician-main" style={{ padding: "18px 16px", maxWidth: 640, margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
