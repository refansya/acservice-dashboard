import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

const PIE_COLORS = ["#6dd3ff", "#ff3b30"];
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Rentang tahun yang bisa dipilih di dropdown - sesuaikan START_YEAR kalau
// data order/invoice paling lama lebih tua dari ini.
const START_YEAR = 2024;
const now = new Date();
const YEAR_OPTIONS = Array.from(
  { length: now.getFullYear() - START_YEAR + 1 },
  (_, i) => START_YEAR + i,
).reverse();

function monthRangeParams(year, month) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function Reports() {
  const [viewMode, setViewMode] = useState("month"); // "month" | "all"
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [revenue, setRevenue] = useState(null);
  const [topServices, setTopServices] = useState([]);
  const [techPerf, setTechPerf] = useState({});
  const [breakdown, setBreakdown] = useState(null);
  const [helperCommissions, setHelperCommissions] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [allTimeRevenue, setAllTimeRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params =
        viewMode === "all"
          ? { range: "all" }
          : monthRangeParams(selectedYear, selectedMonth);

      const [rev, top, tech, cat, helper, reminder, allTime] =
        await Promise.all([
          api.get("/reports/revenue", { params }),
          api.get("/reports/top-services", { params }),
          api.get("/reports/technician-performance", { params }),
          api.get("/reports/category-breakdown", { params }),
          api.get("/reports/helper-commissions", { params }),
          api.get("/reports/preventive-reminders"),
          api.get("/reports/revenue", { params: { range: "all" } }),
        ]);
      setRevenue(rev.data);
      setTopServices(top.data);
      setTechPerf(tech.data);
      setBreakdown(cat.data);
      setHelperCommissions(helper.data);
      setReminders(reminder.data);
      setAllTimeRevenue(allTime.data);
      setLoading(false);
    }
    load();
  }, [viewMode, selectedMonth, selectedYear]);

  const techRows = Object.entries(techPerf).map(([name, s]) => ({
    name,
    ...s,
  }));
  const pieData = breakdown
    ? [
        { name: "AC", value: breakdown.AC },
        { name: "Elektronik", value: breakdown.ELEKTRONIK },
      ]
    : [];

  const periodLabel =
    viewMode === "all"
      ? "Seluruh waktu"
      : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div>
      <PageHeader
        title="Laporan"
        subtitle={`Revenue, servis terlaris, dan performa teknisi — ${periodLabel}`}
      />

      {/* Filter periode */}
      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Tampilkan:
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn"
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              border: "1px solid var(--border-strong)",
              background:
                viewMode === "month" ? "var(--ice-400)" : "transparent",
              color:
                viewMode === "month" ? "var(--navy-950)" : "var(--text-muted)",
            }}
            onClick={() => setViewMode("month")}
          >
            Per Bulan
          </button>
          <button
            className="btn"
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              border: "1px solid var(--border-strong)",
              background: viewMode === "all" ? "var(--ice-400)" : "transparent",
              color:
                viewMode === "all" ? "var(--navy-950)" : "var(--text-muted)",
            }}
            onClick={() => setViewMode("all")}
          >
            Semua Waktu
          </button>
        </div>

        {viewMode === "month" && (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{ width: "auto", minWidth: 140 }}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ width: "auto", minWidth: 100 }}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Memuat...</div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <StatCard
              label={`Revenue — ${periodLabel}`}
              value={formatRupiah(revenue?.totalRevenue)}
              accent="var(--success)"
            />
            <StatCard
              label="Jumlah invoice lunas"
              value={revenue?.invoiceCount ?? 0}
            />
            <StatCard
              label="Jenis layanan terlaris"
              value={topServices[0]?.name || "—"}
              accent="var(--ice-400)"
            />
            <StatCard
              label="Total transaksi keseluruhan"
              value={formatRupiah(allTimeRevenue?.totalRevenue)}
              accent="var(--signal-red)"
              suffix={`${allTimeRevenue?.invoiceCount ?? 0} invoice`}
            />
          </div>

          {reminders.length > 0 && (
            <div
              className="card"
              style={{
                padding: 18,
                marginBottom: 16,
                borderColor: "var(--warning)",
              }}
            >
              <h3 style={{ fontSize: 14.5, marginBottom: 8 }}>
                Reminder preventive maintenance ({reminders.length})
              </h3>
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  marginBottom: 10,
                }}
              >
                Maintenance yang jatuh tempo dalam 7 hari. Gunakan tombol
                WhatsApp untuk menghubungi pelanggan.
              </div>
              {reminders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span>
                    {order.customer.name} -{" "}
                    {order.serviceItem || order.serviceType.name}{" "}
                    <small style={{ color: "var(--text-faint)" }}>
                      (
                      {new Date(order.reminderDate).toLocaleDateString("id-ID")}
                      )
                    </small>
                  </span>
                  <a
                    className="btn btn-ghost"
                    style={{ padding: "4px 9px", fontSize: 12 }}
                    href={`https://wa.me/${order.customer.phone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(`Halo ${order.customer.name}, kami dari Project.id Service. Jadwal preventive maintenance untuk unit Anda sudah tiba. Apakah ingin kami jadwalkan kunjungan?`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                </div>
              ))}
            </div>
          )}

          <div
            className="report-chart-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14.5, marginBottom: 16 }}>
                Servis terlaris — {periodLabel}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={topServices}
                  layout="vertical"
                  margin={{ left: 10 }}
                >
                  <XAxis
                    type="number"
                    stroke="var(--text-faint)"
                    fontSize={11}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    stroke="var(--text-faint)"
                    fontSize={11.5}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--navy-800)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12.5,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--ice-400)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14.5, marginBottom: 16 }}>
                AC vs Elektronik
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--navy-800)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12.5,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 16,
                  fontSize: 12.5,
                  marginTop: -10,
                }}
              >
                {pieData.map((d, i) => (
                  <div
                    key={d.name}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: PIE_COLORS[i],
                      }}
                    />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14.5, marginBottom: 14 }}>
              Performa teknisi — {periodLabel}
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Teknisi</th>
                  <th>Total order</th>
                  <th>Selesai</th>
                  <th>Tingkat penyelesaian</th>
                </tr>
              </thead>
              <tbody>
                {techRows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--text-faint)" }}>
                      Belum ada data.
                    </td>
                  </tr>
                )}
                {techRows.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td className="mono">{t.total}</td>
                    <td className="mono">{t.done}</td>
                    <td className="mono">
                      {t.total ? Math.round((t.done / t.total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <h3 style={{ fontSize: 14.5, marginBottom: 14 }}>
              Komisi helper — {periodLabel}
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Helper</th>
                  <th>Jumlah kunjungan</th>
                  <th>Total komisi</th>
                </tr>
              </thead>
              <tbody>
                {(!helperCommissions ||
                  Object.keys(helperCommissions.summary).length === 0) && (
                  <tr>
                    <td colSpan={3} style={{ color: "var(--text-faint)" }}>
                      Belum ada data komisi helper.
                    </td>
                  </tr>
                )}
                {helperCommissions &&
                  Object.entries(helperCommissions.summary).map(([name, s]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="mono">{s.jobCount}</td>
                      <td className="mono" style={{ color: "var(--success)" }}>
                        {formatRupiah(s.totalCommission)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
