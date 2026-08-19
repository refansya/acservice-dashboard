const prisma = require("../config/prisma");

// Query params: from, to (ISO date strings)
function parseDateRange(req) {
  const { from, to } = req.query;
  return {
    gte: from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    lte: to ? new Date(to) : new Date(),
  };
}

async function revenueSummary(req, res) {
  const range = parseDateRange(req);

  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", paidAt: range },
    select: { total: true, paidAt: true },
  });

  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  res.json({
    range,
    totalRevenue,
    invoiceCount: invoices.length,
  });
}

async function topServices(req, res) {
  const range = parseDateRange(req);

  const orders = await prisma.order.findMany({
    where: { createdAt: range, status: { in: ["DONE", "INVOICED"] } },
    include: { serviceType: true },
  });

  const counts = {};
  for (const order of orders) {
    const key = order.serviceType.name;
    counts[key] = (counts[key] || 0) + 1;
  }

  const result = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.json(result);
}

async function technicianPerformance(req, res) {
  const range = parseDateRange(req);

  const orders = await prisma.order.findMany({
    where: { createdAt: range, technicianId: { not: null } },
    include: { technician: true },
  });

  const stats = {};
  for (const order of orders) {
    const key = order.technician.name;
    if (!stats[key]) stats[key] = { total: 0, done: 0 };
    stats[key].total += 1;
    if (order.status === "DONE" || order.status === "INVOICED") stats[key].done += 1;
  }

  res.json(stats);
}

async function categoryBreakdown(req, res) {
  const range = parseDateRange(req);

  const orders = await prisma.order.findMany({
    where: { createdAt: range },
    include: { serviceType: true },
  });

  const breakdown = { AC: 0, ELEKTRONIK: 0 };
  for (const order of orders) {
    breakdown[order.serviceType.category] += 1;
  }

  res.json(breakdown);
}

async function helperCommissions(req, res) {
  const range = parseDateRange(req);

  const helpers = await prisma.orderHelper.findMany({
    where: { order: { createdAt: range } },
    include: { order: { select: { orderNumber: true, jobType: true } } },
    orderBy: { createdAt: "desc" },
  });

  const summary = {};
  for (const h of helpers) {
    if (!summary[h.name]) summary[h.name] = { totalCommission: 0, jobCount: 0 };
    summary[h.name].totalCommission += Number(h.commissionAmount);
    summary[h.name].jobCount += 1;
  }

  res.json({ details: helpers, summary });
}

async function preventiveReminders(req, res) {
  const until = new Date();
  until.setDate(until.getDate() + 7);
  const orders = await prisma.order.findMany({
    where: { serviceType: { code: "MNT" }, reminderDate: { lte: until }, status: { in: ["DONE", "INVOICED"] } },
    include: { customer: true, technician: true, serviceType: true },
    orderBy: { reminderDate: "asc" },
  });
  res.json(orders);
}

module.exports = { revenueSummary, topServices, technicianPerformance, categoryBreakdown, helperCommissions, preventiveReminders };
