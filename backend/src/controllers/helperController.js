const { z } = require("zod");
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const helperSchema = z.object({ name: z.string().min(2), phone: z.string().min(6), isActive: z.boolean().optional() });

async function list(req, res) {
  res.json(await prisma.helper.findMany({ where: { isActive: req.query.active === "true" ? true : undefined }, include: { _count: { select: { assignments: true } }, account: { select: { email: true } } }, orderBy: { name: "asc" } }));
}
async function create(req, res) { res.status(201).json(await prisma.helper.create({ data: helperSchema.parse(req.body) })); }
async function update(req, res) { res.json(await prisma.helper.update({ where: { id: req.params.id }, data: helperSchema.partial().parse(req.body) })); }
async function createAccount(req, res) {
  const data = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(req.body);
  const helper = await prisma.helper.findUniqueOrThrow({ where: { id: req.params.id } });
  const user = await prisma.user.create({ data: { name: helper.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 10), role: "HELPER", helperId: helper.id } });
  res.status(201).json({ id: user.id, email: user.email, role: user.role });
}
async function myAssignments(req, res) {
  if (!req.user.helperId) return res.status(403).json({ error: "Akun ini belum terhubung ke data helper" });
  const assignments = await prisma.orderHelper.findMany({ where: { helperId: req.user.helperId }, include: { order: { include: { customer: true, technician: true, serviceType: true, invoice: true } } }, orderBy: { createdAt: "desc" } });
  const totalCommission = assignments.reduce((total, a) => total + Number(a.commissionAmount), 0);
  res.json({ assignments, totalCommission });
}
module.exports = { list, create, update, createAccount, myAssignments };
