const COLORS = {
  PENDING: "var(--warning)",
  ASSIGNED: "var(--ice-400)",
  IN_PROGRESS: "var(--ice-400)",
  DONE: "var(--success)",
  INVOICED: "var(--success)",
  CANCELLED: "var(--signal-red)",
  UNPAID: "var(--warning)",
  PAID: "var(--success)",
  PARTIAL: "var(--ice-400)",
  VOID: "var(--signal-red)",
  AVAILABLE: "var(--success)",
  ON_DUTY: "var(--ice-400)",
  OFF: "var(--text-faint)",
  AC: "var(--ice-400)",
  ELEKTRONIK: "var(--signal-red)",
};

const LABELS = {
  PENDING: "Menunggu",
  ASSIGNED: "Ditugaskan",
  IN_PROGRESS: "Dikerjakan",
  DONE: "Selesai",
  INVOICED: "Diinvoice",
  CANCELLED: "Dibatalkan",
  UNPAID: "Belum Bayar",
  PAID: "Lunas",
  PARTIAL: "Sebagian",
  VOID: "Batal",
  AVAILABLE: "Tersedia",
  ON_DUTY: "Bertugas",
  OFF: "Nonaktif",
  AC: "AC",
  ELEKTRONIK: "Elektronik",
};

export default function StatusBadge({ status }) {
  const color = COLORS[status] || "var(--text-muted)";
  return (
    <span className="badge" style={{ color, borderColor: color + "55" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {LABELS[status] || status}
    </span>
  );
}
