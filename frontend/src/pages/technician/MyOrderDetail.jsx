import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";
import StatusBadge from "../../components/StatusBadge";

const API_ORIGIN = (
  import.meta.env.VITE_API_URL || "http://localhost:4000/api"
).replace(/\/api\/?$/, "");

const JOB_TYPE_LABELS = {
  INSTALASI: "Instalasi",
  MAINTENANCE: "Maintenance",
  SERVICE: "Service / Repair",
};

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function MyOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [notes, setNotes] = useState("");
  const [findings, setFindings] = useState({
    complaint: "",
    rootCause: "",
    repairAction: "",
  });
  const [findingsSuccess, setFindingsSuccess] = useState("");
  const [jobType, setJobType] = useState("");
  const [jobCost, setJobCost] = useState("");
  const [helpers, setHelpers] = useState([]);
  const [availableHelpers, setAvailableHelpers] = useState([]);
  const [selectedHelperId, setSelectedHelperId] = useState("");
  const [helperInput, setHelperInput] = useState({ name: "", phone: "" });
  const [savingJob, setSavingJob] = useState(false);
  const [jobError, setJobError] = useState("");
  const [jobSuccess, setJobSuccess] = useState("");
  const [itemForm, setItemForm] = useState({ name: "", qty: 1, unitPrice: "" });
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState("");
  const [checkoutAmount, setCheckoutAmount] = useState("");
  const [checkoutMethod, setCheckoutMethod] = useState("CASH");
  const [checkoutFullPay, setCheckoutFullPay] = useState(true);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [printing, setPrinting] = useState(false);
  const beforeInputRef = useRef(null);
  const afterInputRef = useRef(null);

  async function load() {
    const { data } = await api.get(`/my/orders/${id}`);
    setOrder(data);
    setNotes(data.technicianNotes || "");
    setFindings({
      complaint: data.complaint || "",
      rootCause: data.rootCause || "",
      repairAction: data.repairAction || "",
    });
    setJobType(
      data.jobType ||
        (data.serviceType?.code === "INS"
          ? "INSTALASI"
          : data.serviceType?.code === "MNT"
            ? "MAINTENANCE"
            : "SERVICE"),
    );
    setJobCost(
      data.jobCost != null
        ? String(data.jobCost)
        : String(data.serviceType?.basePrice || ""),
    );
    setHelpers(
      (data.helpers || []).map((h) => ({
        name: h.name,
        phone: h.phone || "",
        helperId: h.helperId,
        commissionPercent: String(h.commissionRate ?? ""),
      })),
    );
  }

  useEffect(() => {
    load();
    api.get("/my/helpers").then(({ data }) => setAvailableHelpers(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStatus(status) {
    try {
      await api.patch(`/my/orders/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal ubah status");
    }
  }

  async function handleSaveNotes() {
    await api.patch(`/my/orders/${id}/notes`, { technicianNotes: notes });
    load();
  }

  async function handleSaveFindings() {
    setError("");
    setFindingsSuccess("");
    try {
      await api.patch(`/my/orders/${id}/findings`, findings);
      setFindingsSuccess("Kerusakan, penyebab, dan perbaikan tersimpan");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Lengkapi data pemeriksaan");
    }
  }

  async function addHelper() {
    if (!helperInput.name.trim()) return;
    if (!helperInput.phone.trim()) {
      setJobError(
        "Nomor HP wajib diisi agar helper baru tersimpan di database",
      );
      return;
    }
    try {
      const { data } = await api.post("/my/helpers", helperInput);
      if (helpers.some((item) => item.helperId === data.id)) {
        setJobError("Helper tersebut sudah ada di order ini");
        return;
      }
      const defaultPercent =
        jobType === "MAINTENANCE" ? "10" : jobType ? "15" : "";
      setAvailableHelpers((items) =>
        items.some((item) => item.id === data.id)
          ? items
          : [...items, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setHelpers((items) => [
        ...items,
        {
          name: data.name,
          phone: data.phone,
          helperId: data.id,
          commissionPercent: defaultPercent,
        },
      ]);
      setHelperInput({ name: "", phone: "" });
      setJobError("");
    } catch (err) {
      setJobError(err.response?.data?.error || "Gagal menambahkan helper baru");
    }
  }

  function addRegisteredHelper() {
    const helper = availableHelpers.find(
      (item) => item.id === selectedHelperId,
    );
    if (!helper) return;
    if (helpers.some((item) => item.helperId === helper.id)) {
      setJobError("Helper tersebut sudah ada di order ini");
      return;
    }
    const defaultPercent =
      jobType === "MAINTENANCE" ? "10" : jobType ? "15" : "";
    setHelpers((items) => [
      ...items,
      {
        name: helper.name,
        phone: helper.phone,
        helperId: helper.id,
        commissionPercent: defaultPercent,
      },
    ]);
    setSelectedHelperId("");
    setJobError("");
  }

  function removeHelper(idx) {
    setHelpers((h) => h.filter((_, i) => i !== idx));
  }

  async function handleSaveJobDetails() {
    setJobError("");
    setJobSuccess("");
    if (!jobType) {
      setJobError("Pilih jenis layanan dulu");
      return;
    }
    if (jobCost === "" || Number(jobCost) < 0) {
      setJobError("Isi biaya pekerjaan");
      return;
    }
    if (
      helpers.reduce(
        (sum, helper) => sum + Number(helper.commissionPercent || 0),
        0,
      ) > 100
    ) {
      setJobError("Total persen komisi helper tidak boleh melebihi 100%");
      return;
    }
    setSavingJob(true);
    try {
      await api.patch(`/my/orders/${id}/job-details`, {
        jobType,
        jobCost: Number(jobCost),
        helpers: helpers.map((helper) => ({
          ...helper,
          commissionPercent: Number(helper.commissionPercent || 0),
        })),
      });
      setJobSuccess("Detail pekerjaan & komisi tersimpan");
      load();
    } catch (err) {
      setJobError(
        err.response?.data?.error || "Gagal menyimpan detail pekerjaan",
      );
    } finally {
      setSavingJob(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    try {
      await api.post(`/my/orders/${id}/items`, {
        name: itemForm.name,
        qty: Number(itemForm.qty),
        unitPrice: Number(itemForm.unitPrice),
      });
      setItemForm({ name: "", qty: 1, unitPrice: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal tambah item");
    }
  }

  async function handleUpload(type, file) {
    if (!file) return;
    setUploading(type);
    setError("");
    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("type", type);
      await api.post(`/my/orders/${id}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal upload foto");
    } finally {
      setUploading(null);
    }
  }

  async function handleCheckout(fullPayOverride) {
    setCheckoutError("");
    setCheckingOut(true);
    try {
      const payFull = fullPayOverride ?? checkoutFullPay;
      await api.post(`/my/orders/${id}/checkout`, {
        method: checkoutMethod,
        amount: payFull ? undefined : Number(checkoutAmount || 0),
      });
      setCheckoutAmount("");
      load();
    } catch (err) {
      setCheckoutError(err.response?.data?.error || "Gagal memproses checkout");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handlePrintReceipt() {
    setCheckoutError("");
    setPrinting(true);
    try {
      const { data } = await api.get(`/my/orders/${id}/receipt`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/pdf" }),
      );
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setCheckoutError(err.response?.data?.error || "Gagal membuka nota");
    } finally {
      setPrinting(false);
    }
  }

  if (!order)
    return <div style={{ color: "var(--text-muted)" }}>Memuat...</div>;

  const beforePhotos = order.photos?.filter((p) => p.type === "BEFORE") || [];
  const afterPhotos = order.photos?.filter((p) => p.type === "AFTER") || [];
  const totalHelperCommission = helpers.reduce(
    (sum, helper) =>
      sum +
      (Number(helper.commissionPercent || 0) / 100) * Number(jobCost || 0),
    0,
  );
  const canFinish =
    beforePhotos.length > 0 &&
    afterPhotos.length > 0 &&
    Boolean(jobType) &&
    jobCost !== "" &&
    findings.complaint.trim().length > 0 &&
    findings.rootCause.trim().length > 0 &&
    findings.repairAction.trim().length > 0 &&
    helpers.every((h) => Number(h.commissionPercent || 0) > 0);
  const invoicePaid =
    order.invoice?.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const invoiceRemaining = order.invoice
    ? Number(order.invoice.total) - invoicePaid
    : 0;

  return (
    <div className="technician-order">
      <button
        className="btn btn-ghost"
        style={{ padding: "5px 10px", fontSize: 12.5, marginBottom: 14 }}
        onClick={() => navigate(-1)}
      >
        ← Kembali
      </button>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 12.5, color: "var(--text-muted)" }}
          >
            {order.orderNumber}
          </span>
          <StatusBadge status={order.status} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          {order.customer?.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {order.customer?.phone}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
          {order.address}
        </div>
        <div style={{ fontSize: 13.5, marginTop: 10 }}>
          {order.serviceType?.code} — {order.serviceType?.name}
        </div>
        {(order.serviceItem || order.brand) && (
          <div
            style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}
          >
            Unit: {[order.serviceItem, order.brand].filter(Boolean).join(" — ")}
          </div>
        )}
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
        >
          <a
            className="btn btn-ghost"
            href={`https://wa.me/${(order.customer?.phone || "").replace(/\D/g, "").replace(/^0/, "62")}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp pelanggan
          </a>
          <a
            className="btn btn-ghost"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
            target="_blank"
            rel="noreferrer"
          >
            Buka peta
          </a>
        </div>
        <div
          style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 12 }}
        >
          Jadwal:{" "}
          {order.scheduledDate
            ? new Date(order.scheduledDate).toLocaleDateString("id-ID", {
                dateStyle: "full",
              })
            : "Belum dijadwalkan"}
        </div>
        {order.complaint && (
          <div
            style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}
          >
            Keluhan: {order.complaint}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Hasil pemeriksaan</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            rows={2}
            value={findings.complaint}
            onChange={(e) =>
              setFindings({ ...findings, complaint: e.target.value })
            }
            placeholder="Kerusakan yang ditemukan"
          />
          <textarea
            rows={2}
            value={findings.rootCause}
            onChange={(e) =>
              setFindings({ ...findings, rootCause: e.target.value })
            }
            placeholder="Penyebab kerusakan"
          />
          <textarea
            rows={2}
            value={findings.repairAction}
            onChange={(e) =>
              setFindings({ ...findings, repairAction: e.target.value })
            }
            placeholder="Perbaikan yang dilakukan"
          />
        </div>
        {findingsSuccess && (
          <div style={{ color: "var(--success)", fontSize: 13, marginTop: 10 }}>
            {findingsSuccess}
          </div>
        )}
        <button
          className="btn btn-primary"
          style={{ marginTop: 10, fontSize: 13 }}
          onClick={handleSaveFindings}
        >
          Simpan Hasil Pemeriksaan
        </button>
      </div>

      {error && (
        <div
          style={{ color: "var(--signal-red)", fontSize: 13, marginBottom: 12 }}
        >
          {error}
        </div>
      )}

      {/* Update status */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>
          Update status pekerjaan
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            style={{
              flex: 1,
              justifyContent: "center",
              border: "1px solid var(--border-strong)",
              background:
                order.status === "IN_PROGRESS"
                  ? "var(--ice-400)"
                  : "transparent",
              color:
                order.status === "IN_PROGRESS"
                  ? "var(--navy-950)"
                  : "var(--text-primary)",
            }}
            disabled={order.status === "DONE" || order.status === "INVOICED"}
            onClick={() => handleStatus("IN_PROGRESS")}
          >
            Mulai Kerjakan
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              justifyContent: "center",
              border: "1px solid var(--border-strong)",
              background:
                order.status === "DONE" ? "var(--success)" : "transparent",
              color:
                order.status === "DONE"
                  ? "var(--navy-950)"
                  : "var(--text-primary)",
            }}
            disabled={order.status === "DONE" || order.status === "INVOICED"}
            onClick={() => handleStatus("DONE")}
          >
            {!canFinish ? "Lengkapi form & foto" : "Selesai"}
          </button>
        </div>
      </div>

      {/* Checkout & cetak nota - teknisi menutup order langsung di lapangan */}
      {(order.status === "DONE" || order.status === "INVOICED") && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>
            Checkout &amp; Cetak Nota
          </h3>

          {!order.invoice ? (
            <>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                Order sudah selesai. Checkout di sini untuk membuat nota dan
                mencatat pembayaran langsung dari pelanggan.
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 12,
                }}
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
                    Metode Pembayaran
                  </label>
                  <select
                    value={checkoutMethod}
                    onChange={(e) => setCheckoutMethod(e.target.value)}
                  >
                    <option value="CASH">Tunai</option>
                    <option value="TRANSFER">Transfer</option>
                    <option value="QRIS">QRIS</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkoutFullPay}
                    onChange={(e) => setCheckoutFullPay(e.target.checked)}
                  />
                  Pelanggan bayar lunas sekarang
                </label>
                {!checkoutFullPay && (
                  <input
                    type="number"
                    min="0"
                    placeholder="Jumlah dibayar (Rp)"
                    value={checkoutAmount}
                    onChange={(e) => setCheckoutAmount(e.target.value)}
                  />
                )}
              </div>
              {checkoutError && (
                <div
                  style={{
                    color: "var(--signal-red)",
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  {checkoutError}
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ fontSize: 13 }}
                onClick={() => handleCheckout()}
                disabled={checkingOut}
              >
                {checkingOut ? "Memproses..." : "Checkout"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                Invoice:{" "}
                <span className="mono">{order.invoice.invoiceNumber}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "3px 0",
                }}
              >
                <span>Total</span>
                <span className="mono">
                  {formatRupiah(order.invoice.total)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "3px 0",
                }}
              >
                <span>Sudah dibayar</span>
                <span className="mono" style={{ color: "var(--success)" }}>
                  {formatRupiah(invoicePaid)}
                </span>
              </div>
              {invoiceRemaining > 0.01 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    padding: "3px 0",
                  }}
                >
                  <span>Sisa Tagihan</span>
                  <span className="mono" style={{ color: "var(--signal-red)" }}>
                    {formatRupiah(invoiceRemaining)}
                  </span>
                </div>
              )}

              {invoiceRemaining > 0.01 && (
                <div
                  style={{
                    marginTop: 10,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    Catat pelunasan sisa tagihan
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={checkoutMethod}
                      onChange={(e) => setCheckoutMethod(e.target.value)}
                      style={{ flex: "1 1 140px" }}
                    >
                      <option value="CASH">Tunai</option>
                      <option value="TRANSFER">Transfer</option>
                      <option value="QRIS">QRIS</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13 }}
                      onClick={() => handleCheckout(true)}
                      disabled={checkingOut}
                    >
                      {checkingOut ? "Memproses..." : "Tandai Lunas"}
                    </button>
                  </div>
                </div>
              )}

              {checkoutError && (
                <div
                  style={{
                    color: "var(--signal-red)",
                    fontSize: 13,
                    marginTop: 10,
                  }}
                >
                  {checkoutError}
                </div>
              )}

              <button
                className="btn btn-ghost"
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  width: "100%",
                  justifyContent: "center",
                }}
                onClick={handlePrintReceipt}
                disabled={printing}
              >
                {printing ? "Membuka nota..." : "🖨️ Cetak Nota"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Detail layanan & komisi helper */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>
          Detail Layanan &amp; Komisi Helper
        </h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 14,
          }}
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
              Jenis Layanan{" "}
              <span style={{ color: "var(--signal-red)" }}>*</span>
            </label>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            >
              <option value="">Pilih jenis layanan</option>
              {Object.entries(JOB_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
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
              Biaya Pekerjaan (Rp){" "}
              <span style={{ color: "var(--signal-red)" }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={jobCost}
              onChange={(e) => setJobCost(e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 14,
            marginBottom: 14,
          }}
        >
          <label
            style={{
              fontSize: 12.5,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 8,
            }}
          >
            Helper (asisten teknisi di kunjungan ini)
          </label>

          {helpers.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 10,
              }}
            >
              {helpers.map((h, idx) => {
                const nominal =
                  (Number(h.commissionPercent || 0) / 100) *
                  Number(jobCost || 0);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                      fontSize: 13,
                      background: "var(--navy-950)",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    <span>
                      {h.name}
                      {h.phone ? ` — ${h.phone}` : ""}
                      {h.helperId ? " (terdaftar)" : ""}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "2px 8px", fontSize: 11.5 }}
                      onClick={() => removeHelper(idx)}
                    >
                      Hapus
                    </button>
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        inputMode="decimal"
                        placeholder="Komisi (%)"
                        value={h.commissionPercent}
                        onChange={(e) =>
                          setHelpers((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === idx
                                ? { ...item, commissionPercent: e.target.value }
                                : item,
                            ),
                          )
                        }
                        style={{ flex: 1 }}
                      />
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatRupiah(nominal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <select
              value={selectedHelperId}
              onChange={(e) => setSelectedHelperId(e.target.value)}
              style={{ flex: "1 1 220px" }}
            >
              <option value="">Pilih helper terdaftar</option>
              {availableHelpers.map((helper) => (
                <option key={helper.id} value={helper.id}>
                  {helper.name} - {helper.phone}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12.5, whiteSpace: "nowrap" }}
              onClick={addRegisteredHelper}
            >
              + Pilih
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-faint)",
              marginBottom: 8,
            }}
          >
            Atau tambah helper dadakan - data akan otomatis masuk ke database
            helper.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Nama helper"
              value={helperInput.name}
              onChange={(e) =>
                setHelperInput({ ...helperInput, name: e.target.value })
              }
            />
            <input
              placeholder="No. HP helper"
              value={helperInput.phone}
              onChange={(e) =>
                setHelperInput({ ...helperInput, phone: e.target.value })
              }
              style={{ width: 140, flex: "1 1 130px" }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12.5, whiteSpace: "nowrap" }}
              onClick={addHelper}
            >
              + Tambah
            </button>
          </div>
        </div>

        {jobType && jobCost !== "" && (
          <div
            style={{
              background: "var(--navy-950)",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 14,
              fontSize: 12.5,
            }}
          >
            <div style={{ color: "var(--text-muted)" }}>
              Komisi diisi manual per orang dalam persen (default{" "}
              {jobType === "MAINTENANCE" ? "10%" : "15%"} dari biaya pekerjaan,
              bisa diubah).
            </div>
            <div style={{ color: "var(--text-muted)", marginTop: 3 }}>
              Total komisi:{" "}
              <span className="mono" style={{ color: "var(--success)" }}>
                {formatRupiah(totalHelperCommission)}
              </span>{" "}
              dari biaya pekerjaan {formatRupiah(Number(jobCost) || 0)}
            </div>
          </div>
        )}

        {jobError && (
          <div
            style={{
              color: "var(--signal-red)",
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            {jobError}
          </div>
        )}
        {jobSuccess && (
          <div
            style={{ color: "var(--success)", fontSize: 13, marginBottom: 10 }}
          >
            {jobSuccess}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ fontSize: 13 }}
          onClick={handleSaveJobDetails}
          disabled={savingJob}
        >
          {savingJob ? "Menyimpan..." : "Simpan Detail Layanan"}
        </button>

        {order.helpers?.length > 0 && (
          <div
            style={{
              marginTop: 14,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--text-faint)",
                marginBottom: 6,
              }}
            >
              Komisi tersimpan:
            </div>
            {order.helpers.map((h) => (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                  padding: "3px 0",
                }}
              >
                <span>{h.name}</span>
                <span className="mono" style={{ color: "var(--success)" }}>
                  {formatRupiah(h.commissionAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catatan */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Catatan pengerjaan</h3>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tulis catatan hasil pengerjaan di lapangan..."
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: 10, fontSize: 13 }}
          onClick={handleSaveNotes}
        >
          Simpan Catatan
        </button>
      </div>

      {/* Sparepart / item */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>
          Sparepart / item dipakai
        </h3>
        {order.items?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {order.items.map((it) => (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "4px 0",
                }}
              >
                <span>
                  {it.name} × {it.qty}
                </span>
                <span className="mono">
                  {formatRupiah(it.unitPrice * it.qty)}
                </span>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={handleAddItem}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <input
            placeholder="Nama item"
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={itemForm.qty}
              onChange={(e) =>
                setItemForm({ ...itemForm, qty: e.target.value })
              }
              style={{ width: 90 }}
            />
            <input
              type="number"
              placeholder="Harga satuan (Rp)"
              value={itemForm.unitPrice}
              onChange={(e) =>
                setItemForm({ ...itemForm, unitPrice: e.target.value })
              }
              required
            />
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}>
            + Tambah Item
          </button>
        </form>
      </div>

      {/* Foto sebelum/sesudah */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>
          Foto sebelum &amp; sesudah
        </h3>

        <div
          className="photo-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Sebelum
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {beforePhotos.map((p) => (
                <img
                  key={p.id}
                  src={API_ORIGIN + p.url}
                  alt="Sebelum"
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
            <input
              ref={beforeInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => handleUpload("BEFORE", e.target.files[0])}
            />
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, width: "100%", justifyContent: "center" }}
              onClick={() => beforeInputRef.current?.click()}
              disabled={uploading === "BEFORE"}
            >
              {uploading === "BEFORE" ? "Mengunggah..." : "+ Foto"}
            </button>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Sesudah
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 8,
              }}
            >
              {afterPhotos.map((p) => (
                <img
                  key={p.id}
                  src={API_ORIGIN + p.url}
                  alt="Sesudah"
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
            <input
              ref={afterInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => handleUpload("AFTER", e.target.files[0])}
            />
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, width: "100%", justifyContent: "center" }}
              onClick={() => afterInputRef.current?.click()}
              disabled={uploading === "AFTER"}
            >
              {uploading === "AFTER" ? "Mengunggah..." : "+ Foto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
