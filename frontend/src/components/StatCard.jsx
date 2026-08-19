export default function StatCard({ label, value, accent = "var(--ice-400)", suffix }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", letterSpacing: "0.06em", marginBottom: 10 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: accent }}>
          {value}
        </span>
        {suffix && <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{suffix}</span>}
      </div>
    </div>
  );
}
