export default function PageHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 12,
        marginBottom: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 22 }}>{title}</h1>
        {subtitle && (
          <p
            style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 6 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
