const { z } = require("zod");
const prisma = require("../config/prisma");
const { createInvoiceForOrder, recordPayment } = require("./invoiceController");

const createOrderSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    newCustomerName: z.string().min(2).optional(),
    newCustomerPhone: z.string().min(6).optional(),
    serviceTypeId: z.string().uuid(),
    technicianId: z.string().uuid().optional(),
    scheduledDate: z.string().optional(),
    address: z.string().min(5),
    complaint: z.string().optional(),
    notes: z.string().optional(),
    serviceItem: z.string().optional(),
    brand: z.string().optional(),
    reminderDate: z.string().optional(),
    helperIds: z.array(z.string().uuid()).optional(),
    proofPhotoUrl: z.string().url().optional().or(z.literal("")),
    items: z
      .array(
        z.object({
          name: z.string(),
          qty: z.number().int().positive().default(1),
          unitPrice: z.number().nonnegative(),
        }),
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.customerId || (data.newCustomerName && data.newCustomerPhone),
    {
      message: "Pilih pelanggan atau isi nama & WhatsApp pelanggan baru",
      path: ["customerId"],
    },
  );

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

async function generateOrderNumber(serviceTypeId, serviceCode) {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const prefix = `${serviceCode === "SVC" ? "SRV" : serviceCode}-${datePart}`;
  const countForDateAndType = await prisma.order.count({
    where: { orderNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(countForDateAndType + 1).padStart(3, "0")}`;
}

async function list(req, res) {
  const { status, category, technicianId, customerId } = req.query;
  const orders = await prisma.order.findMany({
    where: {
      status: status || undefined,
      technicianId: technicianId || undefined,
      customerId: customerId || undefined,
      serviceType: category ? { category } : undefined,
    },
    include: {
      customer: true,
      technician: true,
      serviceType: true,
      items: true,
      helpers: true,
      photos: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
}

async function getById(req, res) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      customer: true,
      technician: true,
      serviceType: true,
      items: true,
      invoice: true,
      helpers: true,
      photos: true,
    },
  });
  res.json(order);
}

async function create(req, res) {
  const data = createOrderSchema.parse(req.body);
  const serviceType = await prisma.serviceType.findUniqueOrThrow({
    where: { id: data.serviceTypeId },
  });
  const orderNumber = await generateOrderNumber(
    data.serviceTypeId,
    serviceType.code,
  );
  const selectedHelpers = data.helperIds?.length
    ? await prisma.helper.findMany({
        where: { id: { in: data.helperIds }, isActive: true },
      })
    : [];
  if (
    data.helperIds?.length &&
    selectedHelpers.length !== data.helperIds.length
  )
    return res
      .status(400)
      .json({ error: "Helper yang dipilih tidak ditemukan atau nonaktif" });
  const helperCount = selectedHelpers.length;
  const helperAmount = helperCount
    ? (Number(serviceType.basePrice) * Number(serviceType.helperRate)) /
      100 /
      helperCount
    : 0;

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

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId,
      serviceTypeId: data.serviceTypeId,
      technicianId: data.technicianId,
      status: data.technicianId ? "ASSIGNED" : "PENDING",
      scheduledDate: data.scheduledDate
        ? new Date(data.scheduledDate)
        : undefined,
      address: data.address,
      complaint: data.complaint,
      notes: data.notes,
      serviceItem: data.serviceItem,
      brand: data.brand,
      reminderDate: data.reminderDate ? new Date(data.reminderDate) : undefined,
      items: data.items ? { create: data.items } : undefined,
      helpers: helperCount
        ? {
            create: selectedHelpers.map((helper) => ({
              helperId: helper.id,
              commissionRate: serviceType.helperRate,
              commissionAmount: helperAmount,
              name: helper.name,
              phone: helper.phone,
            })),
          }
        : undefined,
      photos: data.proofPhotoUrl
        ? { create: { type: "AFTER", url: data.proofPhotoUrl } }
        : undefined,
    },
    include: {
      customer: true,
      technician: true,
      serviceType: true,
      items: true,
    },
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
        photos: true,
      },
    }),
  );
}

async function assignTechnician(req, res) {
  const schema = z.object({ technicianId: z.string().uuid() });
  const { technicianId } = schema.parse(req.body);

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { technicianId, status: "ASSIGNED" },
  });
  res.json(order);
}

async function updateStatus(req, res) {
  const { status } = updateStatusSchema.parse(req.body);
  const current = await prisma.order.findUniqueOrThrow({ where: { id: req.params.id }, include: { serviceType: true } });
  const reminderDate = status === "DONE" && current.serviceType.code === "MNT"
    ? new Date(new Date().setMonth(new Date().getMonth() + 3))
    : undefined;
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status, completedAt: status === "DONE" ? new Date() : undefined, reminderDate },
  });
  res.json(order);
}

async function addItem(req, res) {
  const schema = z.object({
    name: z.string(),
    qty: z.number().int().positive().default(1),
    unitPrice: z.number().nonnegative(),
  });
  const data = schema.parse(req.body);
  const item = await prisma.orderItem.create({
    data: { ...data, orderId: req.params.id },
  });
  res.status(201).json(item);
}

// Checkout kasir: generate invoice dari order DONE, opsional langsung catat pembayaran (lunas atau DP)
async function checkout(req, res) {
  const schema = z.object({
    discountPercent: z.number().min(0).max(100).optional(),
    payment: z
      .object({
        amount: z.number().positive(),
        method: z.enum(["CASH", "TRANSFER", "QRIS", "OTHER"]),
        note: z.string().optional(),
      })
      .optional(),
  });
  const { discountPercent = 0, payment } = schema.parse(req.body);
  const order = await prisma.order.findUniqueOrThrow({ where: { id: req.params.id }, include: { items: true, serviceType: true } });
  const itemsTotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
  const serviceCost = order.jobCost != null ? Number(order.jobCost) : Number(order.serviceType.basePrice);
  const discount = Math.round((serviceCost + itemsTotal) * discountPercent) / 100;

  let invoice = await createInvoiceForOrder(req.params.id, discount);
  if (payment) {
    invoice = await recordPayment(
      invoice.id,
      payment.amount,
      payment.method,
      payment.note,
    );
  } else {
    invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: {
        payments: true,
        order: { include: { customer: true, serviceType: true } },
      },
    });
  }
  res.status(201).json(invoice);
}

module.exports = {
  list,
  getById,
  create,
  assignTechnician,
  updateStatus,
  addItem,
  checkout,
};
