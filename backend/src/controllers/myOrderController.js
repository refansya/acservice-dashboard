const { z } = require("zod");
const prisma = require("../config/prisma");
const {
  createInvoiceForOrder,
  recordPayment,
  renderReceiptPdf,
} = require("./invoiceController");

function requireTechnician(req, res) {
  if (!req.user.technicianId) {
    res.status(403).json({ error: "Akun ini tidak terhubung ke data teknisi" });
    return null;
  }
  return req.user.technicianId;
}

async function generateOrderNumber(serviceCode) {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `${serviceCode === "SVC" ? "SRV" : serviceCode}-${datePart}`;
  const count = await prisma.order.count({
    where: { orderNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

async function myOrders(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const { status } = req.query;
  const orders = await prisma.order.findMany({
    where: { technicianId, status: status || undefined },
    include: {
      customer: true,
      serviceType: true,
      items: true,
      photos: true,
      helpers: true,
    },
    orderBy: { scheduledDate: "asc" },
  });
  res.json(orders);
}

async function availableHelpers(req, res) {
  res.json(
    await prisma.helper.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
  );
}

async function createAvailableHelper(req, res) {
  const data = z
    .object({ name: z.string().trim().min(2), phone: z.string().trim().min(6) })
    .parse(req.body);
  const existing = await prisma.helper.findFirst({
    where: { phone: data.phone },
  });
  if (existing) return res.json(existing);
  res.status(201).json(await prisma.helper.create({ data }));
}

async function myOrderDetail(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const order = await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
    include: {
      customer: true,
      serviceType: true,
      items: true,
      photos: true,
      helpers: true,
      invoice: { include: { payments: { orderBy: { createdAt: "asc" } } } },
    },
  });
  res.json(order);
}

async function updateStatus(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const schema = z.object({ status: z.enum(["IN_PROGRESS", "DONE"]) });
  const { status } = schema.parse(req.body);

  const order = await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
    include: { helpers: true },
  });
  if (status === "DONE") {
    const beforePhoto = await prisma.orderPhoto.findFirst({
      where: { orderId: order.id, type: "BEFORE" },
    });
    const afterPhoto = await prisma.orderPhoto.findFirst({
      where: { orderId: order.id, type: "AFTER" },
    });
    if (!beforePhoto || !afterPhoto)
      return res.status(400).json({
        error:
          "Unggah foto sebelum dan sesudah pengerjaan sebelum menyelesaikan order",
      });
    if (
      !order.jobType ||
      order.jobCost == null ||
      !order.complaint?.trim() ||
      !order.rootCause?.trim() ||
      !order.repairAction?.trim()
    ) {
      return res.status(400).json({
        error:
          "Lengkapi kerusakan, penyebab, dan perbaikan sebelum menyelesaikan order",
      });
    }
    if (order.helpers.some((h) => Number(h.commissionAmount) <= 0)) {
      return res.status(400).json({
        error: "Isi komisi untuk setiap helper sebelum menyelesaikan order",
      });
    }
  }
  const reminderDate =
    order.jobType === "MAINTENANCE"
      ? new Date(new Date().setMonth(new Date().getMonth() + 3))
      : undefined;
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status,
      completedAt: status === "DONE" ? new Date() : undefined,
      reminderDate: status === "DONE" ? reminderDate : undefined,
    },
  });
  res.json(updated);
}

async function updateFindings(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;
  const data = z
    .object({
      complaint: z.string().trim().min(2),
      rootCause: z.string().trim().min(2),
      repairAction: z.string().trim().min(2),
    })
    .parse(req.body);
  const order = await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
  });
  res.json(await prisma.order.update({ where: { id: order.id }, data }));
}

async function createMyOrder(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;
  const schema = z.object({
    customerName: z.string().trim().min(2),
    customerPhone: z.string().trim().min(6),
    address: z.string().trim().min(5),
    serviceTypeId: z.string().uuid(),
    serviceItem: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    complaint: z.string().trim().optional(),
    scheduledDate: z.string().optional(),
  });
  const data = schema.parse(req.body);
  const serviceType = await prisma.serviceType.findUniqueOrThrow({
    where: { id: data.serviceTypeId },
  });
  const customer = await prisma.customer.create({
    data: {
      name: data.customerName,
      phone: data.customerPhone,
      address: data.address,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: await generateOrderNumber(serviceType.code),
      customerId: customer.id,
      technicianId,
      serviceTypeId: data.serviceTypeId,
      status: "ASSIGNED",
      address: data.address,
      serviceItem: data.serviceItem || undefined,
      brand: data.brand || undefined,
      complaint: data.complaint || undefined,
      scheduledDate: data.scheduledDate
        ? new Date(data.scheduledDate)
        : new Date(),
    },
    include: { customer: true, serviceType: true },
  });
  res.status(201).json(order);
}

async function updateNotes(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const schema = z.object({ technicianNotes: z.string() });
  const { technicianNotes } = schema.parse(req.body);

  const order = await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
  });
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { technicianNotes },
  });
  res.json(updated);
}

async function addItem(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const schema = z.object({
    name: z.string(),
    qty: z.number().int().positive().default(1),
    unitPrice: z.number().nonnegative(),
  });
  const data = schema.parse(req.body);

  await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
  });
  const item = await prisma.orderItem.create({
    data: { ...data, orderId: req.params.id },
  });
  res.status(201).json(item);
}

async function uploadPhoto(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const schema = z.object({ type: z.enum(["BEFORE", "AFTER"]) });
  const { type } = schema.parse(req.body);

  if (!req.file) {
    return res.status(400).json({ error: "File foto wajib disertakan" });
  }

  await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
  });

  const photo = await prisma.orderPhoto.create({
    data: {
      orderId: req.params.id,
      type,
      url: `/uploads/${req.file.filename}`,
    },
  });

  res.status(201).json(photo);
}

async function saveJobDetails(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const schema = z.object({
    jobType: z.enum(["INSTALASI", "MAINTENANCE", "SERVICE"]),
    jobCost: z.number().nonnegative(),
    helpers: z
      .array(
        z.object({
          name: z.string().min(1),
          phone: z.string().optional(),
          helperId: z.string().uuid().optional(),
          commissionPercent: z.number().min(0).max(100),
        }),
      )
      .default([]),
  });
  const data = schema.parse(req.body);

  await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
  });
  const totalPercent = data.helpers.reduce(
    (sum, helper) => sum + helper.commissionPercent,
    0,
  );
  if (totalPercent > 100)
    return res
      .status(400)
      .json({ error: "Total persen komisi helper tidak boleh melebihi 100%" });

  if (
    data.helpers.some((helper) => !helper.helperId && !helper.phone?.trim())
  ) {
    return res
      .status(400)
      .json({ error: "Nomor HP wajib diisi untuk helper baru" });
  }

  const normalizedHelpers = [];
  for (const helper of data.helpers) {
    let profile;
    if (helper.helperId) {
      profile = await prisma.helper.findFirst({
        where: { id: helper.helperId, isActive: true },
      });
      if (!profile)
        return res
          .status(400)
          .json({ error: "Helper yang dipilih tidak lagi aktif" });
    } else {
      profile = await prisma.helper.findFirst({
        where: { phone: helper.phone.trim() },
      });
      if (!profile) {
        profile = await prisma.helper.create({
          data: { name: helper.name.trim(), phone: helper.phone.trim() },
        });
      }
    }
    normalizedHelpers.push({
      ...helper,
      helperId: profile.id,
      name: profile.name,
      phone: profile.phone,
    });
  }

  const order = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: req.params.id },
      data: { jobType: data.jobType, jobCost: data.jobCost },
    });

    await tx.orderHelper.deleteMany({ where: { orderId: req.params.id } });

    if (normalizedHelpers.length > 0) {
      await tx.orderHelper.createMany({
        data: normalizedHelpers.map((h) => ({
          orderId: req.params.id,
          name: h.name,
          phone: h.phone,
          helperId: h.helperId,
          commissionRate: h.commissionPercent,
          commissionAmount: (h.commissionPercent / 100) * data.jobCost,
        })),
      });
    }

    return tx.order.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        customer: true,
        serviceType: true,
        items: true,
        photos: true,
        helpers: true,
      },
    });
  });

  res.json(order);
}

// Checkout di lapangan: teknisi membuatkan invoice dari order miliknya sendiri
// (kalau belum ada) lalu langsung mencatat pembayaran dari pelanggan saat itu
// juga. Dibatasi ke order milik teknisi yang login — beda dari endpoint kasir
// admin (/api/orders/:id/checkout) yang bisa menyentuh order siapa saja.
async function checkout(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const schema = z.object({
    discount: z.number().nonnegative().optional(),
    amount: z.number().positive().optional(), // kosongkan untuk bayar lunas otomatis
    method: z.enum(["CASH", "TRANSFER", "QRIS", "OTHER"]).default("CASH"),
    note: z.string().optional(),
  });
  const { discount = 0, amount, method, note } = schema.parse(req.body);

  const order = await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
  });
  if (order.status !== "DONE" && order.status !== "INVOICED") {
    return res.status(400).json({
      error: "Order harus berstatus Selesai (DONE) sebelum bisa checkout",
    });
  }

  let invoice = await createInvoiceForOrder(order.id, discount);
  invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    include: { payments: true },
  });
  const alreadyPaid = invoice.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const remaining = Number(invoice.total) - alreadyPaid;
  const payAmount = amount != null ? amount : remaining;

  if (payAmount > 0.01) {
    invoice = await recordPayment(invoice.id, payAmount, method, note);
  } else {
    invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: {
        payments: { orderBy: { createdAt: "asc" } },
        order: { include: { customer: true, serviceType: true } },
      },
    });
  }
  res.status(201).json(invoice);
}

// Cetak nota untuk order milik teknisi yang login. Order harus sudah
// di-checkout (invoice sudah dibuat) terlebih dulu.
async function myReceipt(req, res) {
  const technicianId = requireTechnician(req, res);
  if (!technicianId) return;

  const order = await prisma.order.findFirstOrThrow({
    where: { id: req.params.id, technicianId },
    include: { invoice: true },
  });
  if (!order.invoice) {
    return res.status(400).json({
      error: "Order ini belum di-checkout, belum ada nota untuk dicetak",
    });
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: order.invoice.id },
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

module.exports = {
  myOrders,
  availableHelpers,
  createAvailableHelper,
  createMyOrder,
  myOrderDetail,
  updateStatus,
  updateNotes,
  updateFindings,
  addItem,
  uploadPhoto,
  saveJobDetails,
  checkout,
  myReceipt,
};
