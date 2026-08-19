import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("admin@projectid.services");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      navigate(
        loggedInUser.role === "TECHNICIAN"
          ? "/my/orders"
          : loggedInUser.role === "HELPER"
            ? "/helper/assignments"
            : "/",
      );
    } catch (err) {
      setError(
        err.response?.data?.error || "Gagal login. Periksa koneksi ke server.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="card" style={{ width: 380, padding: 32 }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            project<span style={{ color: "var(--signal-red)" }}>.id</span>{" "}
            Services
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-faint)",
              letterSpacing: "0.06em",
              marginTop: 4,
            }}
          >
            ADMIN DASHBOARD — AC &amp; ELEKTRONIK
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <label
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
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
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>

          {error && (
            <div style={{ color: "var(--signal-red)", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ justifyContent: "center", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
