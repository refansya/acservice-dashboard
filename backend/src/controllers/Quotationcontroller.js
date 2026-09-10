const { z } = require("zod");
const prisma = require("../config/prisma");
const PDFDocument = require("pdfkit");
const path = require("path");

const quotationItemSchema = z.object({
  name: z.string(),
  qty: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

const quotationInputSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    newCustomerName: z.string().min(2).optional(),
    newCustomerPhone: z.string().min(6).optional(),
    serviceTypeId: z.string().uuid(),
    jobType: z.enum(["INSTALASI", "MAINTENANCE", "SERVICE"]).optional(),
    serviceItem: z.string().optional(),
    brand: z.string().optional(),
    address: z.string().min(5),
    notes: z.string().optional(),
    discountPercent: z.number().min(0).max(100).default(0),
    validUntil: z.string().optional(),
    items: z.array(quotationItemSchema).optional(),
  })
  .refine(
    (data) =>
      data.customerId || (data.newCustomerName && data.newCustomerPhone),
    {
      message: "Pilih pelanggan atau isi nama & WhatsApp pelanggan baru",
      path: ["customerId"],
    },
  );

async function generateQuotationNumber(serviceCode) {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const prefix = `PNW-${serviceCode === "SVC" ? "SRV" : serviceCode}-${datePart}`;
  const countToday = await prisma.quotation.count({
    where: { quotationNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(countToday + 1).padStart(3, "0")}`;
}

// Dipakai juga saat convert ke Order, supaya nomor order tetap konsisten
// dengan yang dibuat lewat halaman Order biasa.
async function generateOrderNumber(serviceCode) {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const prefix = `${serviceCode === "SVC" ? "SRV" : serviceCode}-${datePart}`;
  const count = await prisma.order.count({
    where: { orderNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

// Diskon dihitung dalam persen HANYA dari harga jasa (basePrice), bukan dari
// subtotal jasa+sparepart. Sparepart/item tambahan tidak ikut kena potongan
// diskon, sesuai revisi - beda dengan Kasir/Checkout order yang menghitung
// diskon dari subtotal keseluruhan.
function computeTotals(items, basePrice, discountPercent) {
  const itemsTotal = (items || []).reduce(
    (sum, i) => sum + i.unitPrice * i.qty,
    0,
  );
  const subtotal = Number(basePrice) + itemsTotal;
  const discount = (Number(basePrice) * discountPercent) / 100;
  const total = Math.max(subtotal - discount, 0);
  return { subtotal, discount, total };
}

async function list(req, res) {
  const { status } = req.query;
  const statuses = status ? status.split(",").filter(Boolean) : undefined;
  const quotations = await prisma.quotation.findMany({
    where: { status: statuses ? { in: statuses } : undefined },
    include: {
      customer: true,
      serviceType: true,
      items: true,
      convertedOrder: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(quotations);
}

async function getById(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      customer: true,
      serviceType: true,
      items: true,
      convertedOrder: true,
    },
  });
  res.json(quotation);
}

async function create(req, res) {
  const data = quotationInputSchema.parse(req.body);
  const serviceType = await prisma.serviceType.findUniqueOrThrow({
    where: { id: data.serviceTypeId },
  });

  let customerId = data.customerId;
  if (!customerId) {
    const newCustomer = await prisma.customer.create({
      data: {
        name: data.newCustomerName,
        phone: data.newCustomerPhone,
        address: data.address,
      },
    });
    customerId = newCustomer.id;
  }

  const { subtotal, discount, total } = computeTotals(
    data.items,
    serviceType.basePrice,
    data.discountPercent,
  );
  const quotationNumber = await generateQuotationNumber(serviceType.code);

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      customerId,
      serviceTypeId: data.serviceTypeId,
      jobType: data.jobType,
      serviceItem: data.serviceItem,
      brand: data.brand,
      address: data.address,
      notes: data.notes,
      subtotal,
      discountPercent: data.discountPercent,
      discount,
      total,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      items: data.items?.length ? { create: data.items } : undefined,
    },
    include: { customer: true, serviceType: true, items: true },
  });

  res.status(201).json(quotation);
}

// Hanya boleh diubah selama masih DRAFT - setelah dikirim (SENT), harga yang
// tercantum harus konsisten dengan apa yang sudah dilihat/disetujui pelanggan.
async function update(req, res) {
  const existing = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
  });
  if (existing.status !== "DRAFT") {
    return res
      .status(400)
      .json({ error: "Hanya penawaran berstatus DRAFT yang bisa diubah" });
  }
  const data = quotationInputSchema.partial().parse(req.body);
  const serviceType = await prisma.serviceType.findUniqueOrThrow({
    where: { id: data.serviceTypeId || existing.serviceTypeId },
  });

  await prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.quotationItem.deleteMany({
        where: { quotationId: existing.id },
      });
    }
    const discountPercent =
      data.discountPercent ?? Number(existing.discountPercent);
    const { subtotal, discount, total } = computeTotals(
      data.items,
      serviceType.basePrice,
      discountPercent,
    );
    await tx.quotation.update({
      where: { id: existing.id },
      data: {
        serviceTypeId: data.serviceTypeId,
        jobType: data.jobType,
        serviceItem: data.serviceItem,
        brand: data.brand,
        address: data.address,
        notes: data.notes,
        discountPercent,
        subtotal,
        discount,
        total,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        items: data.items?.length ? { create: data.items } : undefined,
      },
    });
  });

  res.json(
    await prisma.quotation.findUniqueOrThrow({
      where: { id: existing.id },
      include: { customer: true, serviceType: true, items: true },
    }),
  );
}

const updateStatusSchema = z.object({
  status: z.enum(["SENT", "APPROVED", "REJECTED", "EXPIRED"]),
});

// Input tambahan saat convert ke Order - persis field yang bisa diisi admin
// waktu membuat order manual baru (teknisi, jadwal, helper, item).
const convertToOrderSchema = z.object({
  technicianId: z.string().uuid().optional(),
  scheduledDate: z.string().optional(),
  helperIds: z.array(z.string().uuid()).optional(),
  // Kalau dikirim, item order mengikuti daftar ini (hasil edit admin di
  // form convert - boleh nambah/hapus/ubah dari item penawaran aslinya).
  // Kalau tidak dikirim (mis. dari klien lama), fallback ke item penawaran
  // apa adanya seperti sebelumnya.
  items: z.array(quotationItemSchema).optional(),
});

async function updateStatus(req, res) {
  const { status } = updateStatusSchema.parse(req.body);
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
  });
  if (quotation.status === "CONVERTED") {
    return res
      .status(400)
      .json({ error: "Penawaran ini sudah dikonversi menjadi order" });
  }
  const updated = await prisma.quotation.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json(updated);
}

// Convert manual ke Order - hanya untuk penawaran yang sudah APPROVED.
// Admin yang memutuskan kapan waktunya, bukan otomatis, karena jadwal/harga
// final bisa saja berubah sedikit saat pelanggan benar-benar konfirmasi.
async function convertToOrder(req, res) {
  const data = convertToOrderSchema.parse(req.body || {});
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { items: true, serviceType: true },
  });
  if (quotation.status !== "APPROVED") {
    return res.status(400).json({
      error: "Hanya penawaran berstatus APPROVED yang bisa dijadikan order",
    });
  }
  if (quotation.convertedOrderId) {
    return res
      .status(400)
      .json({ error: "Penawaran ini sudah pernah dikonversi menjadi order" });
  }

  // Helper & komisi dihitung persis seperti alur "Order Baru" manual di
  // orderController.create: total pool komisi = basePrice * helperRate,
  // dibagi rata ke semua helper yang dipilih.
  const selectedHelpers = data.helperIds?.length
    ? await prisma.helper.findMany({
        where: { id: { in: data.helperIds }, isActive: true },
      })
    : [];
  if (
    data.helperIds?.length &&
    selectedHelpers.length !== data.helperIds.length
  ) {
    return res
      .status(400)
      .json({ error: "Helper yang dipilih tidak ditemukan atau nonaktif" });
  }
  const helperCount = selectedHelpers.length;
  const helperAmount = helperCount
    ? (Number(quotation.serviceType.basePrice) *
        Number(quotation.serviceType.helperRate)) /
      100 /
      helperCount
    : 0;

  const orderNumber = await generateOrderNumber(quotation.serviceType.code);

  // Kalau admin mengubah/menambah item di form convert, pakai daftar itu.
  // Kalau tidak dikirim sama sekali, pakai item penawaran aslinya apa adanya
  // (perilaku lama, tetap kompatibel).
  const orderItems = data.items ?? quotation.items;

  // Kunci harga jasa PERSIS seperti yang sudah disetujui di penawaran
  // (basePrice dikurangi diskon jasa) lewat field jobCost - supaya nanti
  // waktu Kasir/Checkout & generate invoice, harga yang dipakai bukan
  // harga jasa standar (basePrice) lagi, tapi harga yang sudah didiskon
  // sesuai penawaran yang disetujui pelanggan.
  const jobCost = Math.max(
    Number(quotation.serviceType.basePrice) - Number(quotation.discount),
    0,
  );

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: quotation.customerId,
        serviceTypeId: quotation.serviceTypeId,
        technicianId: data.technicianId,
        status: data.technicianId ? "ASSIGNED" : "PENDING",
        scheduledDate: data.scheduledDate
          ? new Date(data.scheduledDate)
          : undefined,
        address: quotation.address,
        serviceItem: quotation.serviceItem,
        brand: quotation.brand,
        jobType: quotation.jobType,
        jobCost,
        items: orderItems.length
          ? {
              create: orderItems.map((i) => ({
                name: i.name,
                qty: i.qty,
                unitPrice: i.unitPrice,
              })),
            }
          : undefined,
        helpers: helperCount
          ? {
              create: selectedHelpers.map((helper) => ({
                helperId: helper.id,
                commissionRate: quotation.serviceType.helperRate,
                commissionAmount: helperAmount,
                name: helper.name,
                phone: helper.phone,
              })),
            }
          : undefined,
      },
    });
    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: "CONVERTED", convertedOrderId: created.id },
    });
    return created;
  });

  res.status(201).json(
    await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        customer: true,
        technician: true,
        serviceType: true,
        items: true,
        helpers: true,
      },
    }),
  );
}

async function remove(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
  });
  if (quotation.status === "CONVERTED") {
    return res.status(400).json({
      error:
        "Tidak bisa menghapus penawaran yang sudah dikonversi menjadi order",
    });
  }
  await prisma.quotation.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

// PDF penawaran - gaya sederhana konsisten dengan nota invoice yang sudah ada,
// ditambah kolom tanda tangan pelanggan (kosong) dan tanda tangan + stempel
// owner (Rizki Minulyo) di kanan.
function renderQuotationPdf(quotation, res) {
  const rupiah = (value) => `Rp ${Number(value).toLocaleString("id-ID")}`;
  const tanggal = (d) =>
    d
      ? new Date(d).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=${quotation.quotationNumber}.pdf`,
  );
  doc.pipe(res);

  const pageWidth = doc.page.width - 80;
  const leftX = 40;
  const logoPath = path.join(
    __dirname,
    "..",
    "..",
    "assets",
    "kop-project-id.png",
  );
  const logoBoxW = 210;
  const logoBoxH = logoBoxW / (1771 / 1181);
  doc.image(logoPath, leftX, 28, {
    fit: [logoBoxW, logoBoxH],
    align: "left",
    valign: "top",
  });

  doc
    .fontSize(15)
    .font("Helvetica-Bold")
    .fillColor("#111")
    .text("SURAT PENAWARAN", leftX, 40, { width: pageWidth, align: "right" });
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#555")
    .text(`No. : ${quotation.quotationNumber}`, leftX, 66, {
      width: pageWidth,
      align: "right",
    });

  let y = 28 + logoBoxH + 24;
  const row = (label, value) => {
    doc
      .fontSize(9.5)
      .font("Helvetica")
      .fillColor("#333")
      .text(label, leftX, y, { width: 95 });
    doc.text(":", leftX + 95, y);
    doc
      .font("Helvetica-Bold")
      .fillColor("#111")
      .text(String(value || "-"), leftX + 107, y, { width: pageWidth - 107 });
    y += 17;
  };
  row("Tanggal", tanggal(quotation.createdAt));
  row("Kepada", quotation.customer.name);
  row("Alamat", quotation.address);
  row("No. HP", quotation.customer.phone);
  row("Layanan", quotation.serviceType.name);
  if (quotation.validUntil) row("Berlaku s/d", tanggal(quotation.validUntil));

  y += 10;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#999")
    .stroke();
  y += 14;

  const col = {
    name: leftX,
    qty: leftX + 260,
    harga: leftX + 310,
    jumlah: leftX + 410,
  };
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#111");
  doc.text("Item", col.name, y);
  doc.text("Qty", col.qty, y, { width: 40, align: "right" });
  doc.text("Harga", col.harga, y, { width: 90, align: "right" });
  doc.text("Jumlah", col.jumlah, y, {
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
  const printRow = (name, qty, unitPrice) => {
    doc.text(name, col.name, y, { width: 250 });
    doc.text(String(qty), col.qty, y, { width: 40, align: "right" });
    doc.text(rupiah(unitPrice), col.harga, y, { width: 90, align: "right" });
    doc.text(rupiah(qty * unitPrice), col.jumlah, y, {
      width: pageWidth - (col.jumlah - leftX),
      align: "right",
    });
    y += 15;
  };
  printRow(
    `${quotation.serviceType.name}${quotation.jobType ? ` (${quotation.jobType})` : ""}`,
    1,
    Number(quotation.serviceType.basePrice),
  );
  quotation.items.forEach((item) =>
    printRow(item.name, item.qty, Number(item.unitPrice)),
  );

  if (Number(quotation.discountPercent) > 0) {
    doc.fillColor("#a32d2d");
    doc.text(`Diskon (${Number(quotation.discountPercent)}%)`, col.name, y);
    doc.text(`-${rupiah(quotation.discount)}`, col.jumlah, y, {
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
  doc.text("Total Penawaran", col.qty, y, {
    width: col.jumlah - col.qty - 6,
    align: "right",
  });
  doc.text(rupiah(quotation.total), col.jumlah, y, {
    width: pageWidth - (col.jumlah - leftX),
    align: "right",
  });
  y += 28;

  if (quotation.notes) {
    doc
      .fontSize(9.5)
      .font("Helvetica")
      .fillColor("#333")
      .text(`Catatan: ${quotation.notes}`, leftX, y, { width: pageWidth });
    y +=
      doc.heightOfString(`Catatan: ${quotation.notes}`, { width: pageWidth }) +
      16;
  }

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#555")
    .text(
      "Penawaran ini berlaku sesuai tanggal di atas. Harga dapat berubah setelah kunjungan survei bila kondisi di lapangan berbeda.",
      leftX,
      y,
      { width: pageWidth },
    );
  y += doc.heightOfString(
    "Penawaran ini berlaku sesuai tanggal di atas. Harga dapat berubah setelah kunjungan survei bila kondisi di lapangan berbeda.",
    { width: pageWidth },
  );

  // ---- Area tanda tangan ----
  // Dipatok mepet ke bagian paling bawah kertas (konsisten secara visual
  // dengan nota/invoice), bukan sekadar menempel di bawah isi penawaran -
  // supaya tidak terlihat menggantung di tengah halaman saat isi penawaran
  // pendek. Kalau isi penawaran ternyata sudah kepanjangan sampai menabrak
  // posisi itu, area ttd dipindah ke halaman baru dan tetap dipatok di
  // bagian paling bawah halaman baru tersebut.
  const signatureBlockHeight = 130;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (y + 20 > pageBottom - signatureBlockHeight) {
    doc.addPage();
    y = doc.page.height - doc.page.margins.bottom - signatureBlockHeight;
  } else {
    y = pageBottom - signatureBlockHeight;
  }

  const sigColW = pageWidth / 2 - 20;
  const leftColX = leftX;
  const rightColX = leftX + sigColW + 40;
  const lineY = y + 70;

  doc.fontSize(9.5).font("Helvetica").fillColor("#333");
  doc.text("Yang mengajukan penawaran,", leftColX, y, {
    width: sigColW,
    align: "center",
  });
  doc.text("Yang menyetujui,", rightColX, y, {
    width: sigColW,
    align: "center",
  });

  // Stempel ditempatkan menumpuk di atas garis tanda tangan owner, sesuai
  // posisi wajar stempel basah di atas tanda tangan pada dokumen fisik.
  const stampPath = path.join(
    __dirname,
    "..",
    "..",
    "assets",
    "stempel-owner.png",
  );
  const stampAspect = 1373 / 911; // rasio asli file stempel-owner.png (lebar/tinggi)
  const stampH = 82;
  const stampW = stampH * stampAspect;
  const stampX = leftColX + (sigColW - stampW) / 2;
  const stampY = lineY - stampH + 12;
  doc.image(stampPath, stampX, stampY, { width: stampW, height: stampH });

  doc.fontSize(9.5).font("Helvetica").fillColor("#333");
  doc.text(".............................", leftColX, lineY, {
    width: sigColW,
    align: "center",
  });
  doc.text(".............................", rightColX, lineY, {
    width: sigColW,
    align: "center",
  });

  let signY = lineY + 14;
  doc.font("Helvetica-Bold").fillColor("#111");
  doc.text("Rizki Minulyo", leftColX, signY, {
    width: sigColW,
    align: "center",
  });
  doc.text(quotation.customer.name, rightColX, signY, {
    width: sigColW,
    align: "center",
  });

  signY += 13;
  doc.fontSize(8.5).font("Helvetica").fillColor("#555");
  doc.text("Owner", leftColX, signY, { width: sigColW, align: "center" });
  doc.text("Pelanggan", rightColX, signY, { width: sigColW, align: "center" });

  doc.end();
}

async function downloadPdf(req, res) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { customer: true, serviceType: true, items: true },
  });
  renderQuotationPdf(quotation, res);
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  convertToOrder,
  remove,
  downloadPdf,
};
