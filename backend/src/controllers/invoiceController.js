const { z } = require("zod");
const prisma = require("../config/prisma");
const PDFDocument = require("pdfkit");
const path = require("path");

async function generateInvoiceNumber(serviceCode) {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `${serviceCode === "SVC" ? "SRV" : serviceCode}-${datePart}`;
  const countToday = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(countToday + 1).padStart(3, "0")}`;
}

async function list(req, res) {
  const { status } = req.query;
  const statuses = status ? status.split(",").filter(Boolean) : undefined;
  const invoices = await prisma.invoice.findMany({
    where: { status: statuses ? { in: statuses } : undefined },
    include: {
      order: { include: { customer: true, serviceType: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(invoices);
}

async function getById(req, res) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      order: {
        include: {
          customer: true,
          serviceType: true,
          items: true,
          technician: true,
        },
      },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  res.json(invoice);
}

// Catat satu pembayaran (bisa sebagian/DP atau lunas) dan hitung ulang status invoice
async function recordPayment(invoiceId, amount, method, note) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (invoice.status === "VOID") {
      const error = new Error("Invoice ini sudah dibatalkan (VOID)");
      error.status = 400;
      throw error;
    }
    const alreadyPaid = invoice.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const remaining = Number(invoice.total) - alreadyPaid;
    if (amount <= 0) {
      const error = new Error("Jumlah pembayaran harus lebih dari 0");
      error.status = 400;
      throw error;
    }
    if (amount > remaining + 0.01) {
      const error = new Error(
        `Jumlah melebihi sisa tagihan (sisa: ${remaining})`,
      );
      error.status = 400;
      throw error;
    }

    await tx.payment.create({ data: { invoiceId, amount, method, note } });
    const totalPaid = alreadyPaid + amount;
    const isPaidOff = totalPaid >= Number(invoice.total) - 0.01;

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: isPaidOff ? "PAID" : "PARTIAL",
        paymentMethod: method,
        paidAt: isPaidOff ? new Date() : invoice.paidAt,
      },
      include: {
        payments: { orderBy: { createdAt: "asc" } },
        order: { include: { customer: true, serviceType: true } },
      },
    });
  });
}

async function addPayment(req, res) {
  const schema = z.object({
    amount: z.number().positive(),
    method: z.enum(["CASH", "TRANSFER", "QRIS", "OTHER"]),
    note: z.string().optional(),
  });
  const { amount, method, note } = schema.parse(req.body);
  const invoice = await recordPayment(req.params.id, amount, method, note);
  res.json(invoice);
}

async function createInvoiceForOrder(orderId, discount = 0) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, serviceType: true, invoice: true },
  });

  if (order.invoice) return order.invoice;
  if (order.status !== "DONE") {
    const error = new Error(
      "Order harus berstatus DONE sebelum invoice dibuat",
    );
    error.status = 400;
    throw error;
  }

  const itemsTotal = order.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.qty,
    0,
  );
  const serviceCost =
    order.jobCost != null
      ? Number(order.jobCost)
      : Number(order.serviceType.basePrice);
  const subtotal = serviceCost + itemsTotal;
  const total = subtotal - discount;
  const invoiceNumber = await generateInvoiceNumber(order.serviceType.code);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { orderId } });
    if (existing) return existing;
    const invoice = await tx.invoice.create({
      data: { invoiceNumber, orderId, subtotal, discount, total },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "INVOICED", completedAt: new Date() },
    });
    return invoice;
  });
}

// Generate invoice dari order yang sudah DONE
async function createFromOrder(req, res) {
  const schema = z.object({ discount: z.number().nonnegative().optional() });
  const { discount = 0 } = schema.parse(req.body);

  const invoice = await createInvoiceForOrder(req.params.orderId, discount);
  res.status(201).json(invoice);
}

// Menggambar PDF nota dari data invoice yang sudah lengkap (order, customer,
// serviceType, technician, items, payments). Dipakai baik oleh endpoint admin
// (/api/invoices/:id/receipt) maupun endpoint teknisi (/api/my/orders/:id/receipt)
// supaya tampilannya selalu konsisten satu sumber kode.
function renderReceiptPdf(invoice, res) {
  const order = invoice.order;
  const rupiah = (value) => `Rp ${Number(value).toLocaleString("id-ID")}`;
  const tanggal = (d) =>
    d
      ? new Date(d).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";
  const titleByJobType = {
    INSTALASI: "NOTA INSTALASI",
    MAINTENANCE: "NOTA MAINTENANCE",
    SERVICE: "NOTA SERVICE",
  };
  const title = titleByJobType[order.jobType] || "NOTA SERVICE";

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=${invoice.invoiceNumber}.pdf`,
  );
  doc.pipe(res);

  const pageWidth = doc.page.width - 80;
  const leftX = 40;
  const labelW = 95;
  const logoPath = path.join(
    __dirname,
    "..",
    "..",
    "assets",
    "kop-project-id.png",
  );

  // Header: kop surat (logo + alamat perusahaan sudah menyatu dalam satu gambar).
  // Box gambar disesuaikan dengan rasio asli agar 5 baris teks di dalamnya
  // (nama, alamat, telp, email) tidak terpotong garis pembatas.
  const logoBoxW = 210;
  const logoBoxH = logoBoxW / (1771 / 1181); // rasio asli gambar kop
  const logoY = 28;
  doc.image(logoPath, leftX, logoY, {
    fit: [logoBoxW, logoBoxH],
    align: "left",
    valign: "top",
  });

  doc
    .fontSize(15)
    .font("Helvetica-Bold")
    .fillColor("#111")
    .text(title, leftX, 40, { width: pageWidth, align: "right" });
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#555")
    .text(`Invoice No. : ${invoice.invoiceNumber}`, leftX, 66, {
      width: pageWidth,
      align: "right",
    });

  const headerRuleY = logoY + logoBoxH + 10;
  doc
    .moveTo(leftX, headerRuleY)
    .lineTo(leftX + pageWidth, headerRuleY)
    .strokeColor("#ccc")
    .stroke();

  // Data pelanggan - tinggi baris dinamis agar alamat panjang tidak menabrak data berikutnya.
  let y = headerRuleY + 14;
  const row = (label, value) => {
    const text = String(value || "-");
    const valueWidth = pageWidth - labelW - 12;
    doc
      .fontSize(9.5)
      .font("Helvetica")
      .fillColor("#333")
      .text(label, leftX, y, { width: labelW });
    doc.text(":", leftX + labelW, y);
    doc
      .font("Helvetica-Bold")
      .fillColor("#111")
      .text(text, leftX + labelW + 12, y, {
        width: valueWidth,
      });
    y += Math.max(17, doc.heightOfString(text, { width: valueWidth }) + 6);
  };
  row("Tanggal Masuk", tanggal(order.scheduledDate || order.createdAt));
  row("Nama", order.customer.name);
  row("Alamat", order.address);
  row("No. HP", order.customer.phone);
  row(
    "Model / Unit",
    [order.serviceItem, order.brand].filter(Boolean).join(" — ") ||
      order.serviceType.name,
  );

  y += 8;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#ccc")
    .stroke();
  y += 14;

  // Rincian biaya mengikuti kolom pada nota manual.
  const col = {
    service: leftX,
    qty: leftX + 260,
    harga: leftX + 310,
    jumlah: leftX + 410,
  };
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#111");
  doc.text("Service", col.service, y);
  doc.text("Qty", col.qty, y, { width: 40, align: "right" });
  doc.text("Harga Satuan", col.harga, y, { width: 90, align: "right" });
  doc.text("Jumlah Harga", col.jumlah, y, {
    width: pageWidth - (col.jumlah - leftX),
    align: "right",
  });
  y += 14;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#999")
    .stroke();
  y += 8;

  doc.font("Helvetica").fontSize(9.5).fillColor("#111");
  const serviceCost =
    order.jobCost != null
      ? Number(order.jobCost)
      : Number(order.serviceType.basePrice);
  const printRow = (name, qty, unitPrice) => {
    doc.text(name, col.service, y, { width: 250 });
    doc.text(String(qty), col.qty, y, { width: 40, align: "right" });
    doc.text(rupiah(unitPrice), col.harga, y, { width: 90, align: "right" });
    doc.text(rupiah(qty * unitPrice), col.jumlah, y, {
      width: pageWidth - (col.jumlah - leftX),
      align: "right",
    });
    y += 15;
  };
  printRow(
    `${order.serviceType.name}${order.jobType ? ` (${order.jobType})` : ""}`,
    1,
    serviceCost,
  );
  order.items.forEach((item) =>
    printRow(item.name, item.qty, Number(item.unitPrice)),
  );
  if (Number(invoice.discount) > 0) {
    doc.fillColor("#a32d2d");
    doc.text("Diskon", col.service, y);
    doc.text(`-${rupiah(invoice.discount)}`, col.jumlah, y, {
      width: pageWidth - (col.jumlah - leftX),
      align: "right",
    });
    doc.fillColor("#111");
    y += 15;
  }
  y += 4;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#999")
    .stroke();
  y += 10;

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("Total Pembayaran", col.qty, y, {
    width: col.jumlah - col.qty - 6,
    align: "right",
  });
  doc.text(rupiah(invoice.total), col.jumlah, y, {
    width: pageWidth - (col.jumlah - leftX),
    align: "right",
  });
  y += 20;

  const totalPaid = invoice.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  if (invoice.payments.length) {
    doc.fontSize(9).font("Helvetica").fillColor("#333");
    invoice.payments.forEach((p) => {
      doc.text(`Bayar (${p.method}) — ${tanggal(p.createdAt)}`, col.qty, y, {
        width: col.jumlah - col.qty - 6,
        align: "right",
      });
      doc.text(rupiah(p.amount), col.jumlah, y, {
        width: pageWidth - (col.jumlah - leftX),
        align: "right",
      });
      y += 13;
    });
  }
  const sisa = Number(invoice.total) - totalPaid;
  if (sisa > 0.01) {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#a32d2d");
    doc.text("Sisa Tagihan", col.qty, y, {
      width: col.jumlah - col.qty - 6,
      align: "right",
    });
    doc.text(rupiah(sisa), col.jumlah, y, {
      width: pageWidth - (col.jumlah - leftX),
      align: "right",
    });
    doc.fillColor("#111");
    y += 16;
  }

  y += 12;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#ccc")
    .stroke();
  y += 14;

  // Hasil pemeriksaan teknisi: kerusakan yang ditemukan, penyebab, dan perbaikan
  // yang dilakukan. Diisi teknisi untuk semua jenis order (termasuk MAINTENANCE)
  // sebelum order bisa diselesaikan, jadi selalu ditampilkan di sini.
  const rightColX = leftX + 260;
  const infoStartY = y;
  row("Tanggal Selesai", tanggal(order.completedAt));
  row("Teknisi", order.technician?.name);

  let ry = infoStartY;
  const rightColW = pageWidth - (rightColX - leftX);
  const rightRow = (label, value) => {
    const text = String(value || "-");
    doc
      .fontSize(9.5)
      .font("Helvetica")
      .fillColor("#333")
      .text(`${label} :`, rightColX, ry, { width: rightColW });
    ry += 12;
    doc
      .font("Helvetica")
      .fillColor("#111")
      .text(text, rightColX, ry, { width: rightColW });
    ry += Math.max(14, doc.heightOfString(text, { width: rightColW }) + 8);
  };
  rightRow("Kerusakan", order.complaint);
  rightRow("Penyebab", order.rootCause);
  rightRow("Perbaikan", order.repairAction);

  y = Math.max(y, ry) + 20;

  // Area tanda tangan
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#333")
    .text("Unit Diterima Dalam Keadaan Baik", leftX, y);
  y += 50;
  const sigColW = pageWidth / 2 - 20;
  doc.text(".............................", leftX, y, {
    width: sigColW,
    align: "center",
  });
  doc.text(".............................", leftX + sigColW + 40, y, {
    width: sigColW,
    align: "center",
  });
  y += 12;
  doc.text("Pelanggan", leftX, y, { width: sigColW, align: "center" });
  doc.text("Penerima Pembayaran", leftX + sigColW + 40, y, {
    width: sigColW,
    align: "center",
  });

  doc.end();
}

async function downloadReceipt(req, res) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      order: {
        include: {
          customer: true,
          serviceType: true,
          technician: true,
          items: true,
        },
      },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  renderReceiptPdf(invoice, res);
}

async function markPaid(req, res) {
  const schema = z.object({
    paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS", "OTHER"]),
  });
  const { paymentMethod } = schema.parse(req.body);

  const existing = await prisma.invoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { payments: true },
  });
  const alreadyPaid = existing.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const remaining = Number(existing.total) - alreadyPaid;
  const invoice = await recordPayment(req.params.id, remaining, paymentMethod);
  res.json(invoice);
}

module.exports = {
  list,
  getById,
  createFromOrder,
  markPaid,
  addPayment,
  downloadReceipt,
  renderReceiptPdf,
  createInvoiceForOrder,
  recordPayment,
};
