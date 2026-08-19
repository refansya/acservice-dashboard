export default function Modal({ open, onClose, title, children, width = 460 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 9, 18, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width, maxWidth: "100%", padding: 24, maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontSize: 16 }}>{title}</h3>
          <button
            onClick={onClose}
            className="btn-ghost btn"
            style={{ padding: "4px 10px", fontSize: 13 }}
          >
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
