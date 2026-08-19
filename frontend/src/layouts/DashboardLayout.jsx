import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Ringkasan", icon: "◧" },
  { to: "/orders", label: "Order", icon: "▤" },
  { to: "/kasir", label: "Kasir", icon: "▥" },
  { to: "/technicians", label: "Teknisi", icon: "◈" },
  { to: "/helpers", label: "Helper", icon: "◇" },
  { to: "/customers", label: "Pelanggan", icon: "◎" },
  { to: "/service-types", label: "Jenis Layanan", icon: "▦" },
  { to: "/invoices", label: "Invoice", icon: "▧" },
  { to: "/reports", label: "Laporan", icon: "◫" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const currentLabel =
    NAV_ITEMS.find((item) =>
      item.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.to),
    )?.label || "";

  return (
    <div className="dashboard-shell">
      <header className="mobile-topbar">
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Buka menu"
        >
          <span />
          <span />
          <span />
        </button>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {currentLabel}
        </div>
        <div style={{ width: 34 }} />
      </header>

      {menuOpen && (
        <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`dashboard-sidebar${menuOpen ? " open" : ""}`}>
        <div
          style={{
            padding: "0 10px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 17,
              }}
            >
              project<span style={{ color: "var(--signal-red)" }}>.id</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--text-faint)",
                letterSpacing: "0.08em",
                marginTop: 2,
              }}
            >
              SERVICES ADMIN
            </div>
          </div>
          <button
            className="hamburger-btn sidebar-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        <nav
          style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: "none",
                color: isActive ? "var(--navy-950)" : "var(--text-muted)",
                background: isActive ? "var(--ice-400)" : "transparent",
              })}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
            marginTop: 14,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.name}</div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--text-faint)",
              marginBottom: 10,
            }}
          >
            {user?.role}
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleLogout}
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}
