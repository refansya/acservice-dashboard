import { useEffect, useState } from "react";
import api from "../api/client";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function Overview() {
  const [revenue, setRevenue] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [rev, cat, orders] = await Promise.all([
          api.get("/reports/revenue"),
          api.get("/reports/category-breakdown"),
          api.get("/orders"),
        ]);
        setRevenue(rev.data);
        setBreakdown(cat.data);
        setRecentOrders(orders.data.slice(0, 6));
      } catch (err) {
        setError(
          "Gagal memuat data. Pastikan backend berjalan dan sudah login.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Ringkasan"
        subtitle="Bulan berjalan — order, revenue, dan aktivitas terbaru"
      />

      {error && (
        <div style={{ color: "var(--signal-red)", marginBottom: 16 }}>
          {error}
        </div>
      )}
      {loading && <div style={{ color: "var(--text-muted)" }}>Memuat...</div>}

      {!loading && !error && (
        <>
          <div className="stat-grid" style={{ marginBottom: 28 }}>
            <StatCard
              label="Revenue bulan ini"
              value={formatRupiah(revenue?.totalRevenue)}
              accent="var(--success)"
            />
            <StatCard
              label="Invoice lunas"
              value={revenue?.invoiceCount ?? 0}
              suffix="invoice"
            />
            <StatCard
              label="Order AC"
              value={breakdown?.AC ?? 0}
              accent="var(--ice-400)"
              suffix="order"
            />
            <StatCard
              label="Order Elektronik"
              value={breakdown?.ELEKTRONIK ?? 0}
              accent="var(--signal-red)"
              suffix="order"
            />
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14.5, marginBottom: 14 }}>Order terbaru</h3>
            <table>
              <thead>
                <tr>
                  <th>No. Order</th>
                  <th>Pelanggan</th>
                  <th>Layanan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--text-faint)" }}>
                      Belum ada order.
                    </td>
                  </tr>
                )}
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.orderNumber}</td>
                    <td>{o.customer?.name}</td>
                    <td>{o.serviceType?.name}</td>
                    <td>
                      <StatusBadge status={o.status} />
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
