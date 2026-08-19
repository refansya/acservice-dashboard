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

export default function Reports() {
  const [revenue, setRevenue] = useState(null);
  const [topServices, setTopServices] = useState([]);
  const [techPerf, setTechPerf] = useState({});
  const [breakdown, setBreakdown] = useState(null);
  const [helperCommissions, setHelperCommissions] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [rev, top, tech, cat, helper, reminder] = await Promise.all([
        api.get("/reports/revenue"),
        api.get("/reports/top-services"),
        api.get("/reports/technician-performance"),
        api.get("/reports/category-breakdown"),
        api.get("/reports/helper-commissions"),
        api.get("/reports/preventive-reminders"),
      ]);
      setRevenue(rev.data);
      setTopServices(top.data);
      setTechPerf(tech.data);
      setBreakdown(cat.data);
      setHelperCommissions(helper.data);
      setReminders(reminder.data);
      setLoading(false);
    }
    load();
  }, []);

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

  return (
    <div>
      <PageHeader
        title="Laporan"
        subtitle="Revenue, servis terlaris, dan performa teknisi bulan berjalan"
      />

      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Memuat...</div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <StatCard
              label="Total revenue"
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
          </div>

          {reminders.length > 0 && <div className="card" style={{ padding: 18, marginBottom: 16, borderColor: "var(--warning)" }}><h3 style={{ fontSize: 14.5, marginBottom: 8 }}>Reminder preventive maintenance ({reminders.length})</h3><div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 10 }}>Maintenance yang jatuh tempo dalam 7 hari. Gunakan tombol WhatsApp untuk menghubungi pelanggan.</div>{reminders.map((order) => <div key={order.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border)" }}><span>{order.customer.name} - {order.serviceItem || order.serviceType.name} <small style={{ color: "var(--text-faint)" }}>({new Date(order.reminderDate).toLocaleDateString("id-ID")})</small></span><a className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 12 }} href={`https://wa.me/${order.customer.phone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(`Halo ${order.customer.name}, kami dari Project.id Service. Jadwal preventive maintenance untuk unit Anda sudah tiba. Apakah ingin kami jadwalkan kunjungan?`)}`} target="_blank" rel="noreferrer">WhatsApp</a></div>)}</div>}

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
                Servis terlaris
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
              Performa teknisi
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
            <h3 style={{ fontSize: 14.5, marginBottom: 14 }}>Komisi helper</h3>
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
