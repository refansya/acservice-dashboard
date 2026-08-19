const { z } = require("zod");
const prisma = require("../config/prisma");

const serviceTypeSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  name: z.string().min(2),
  category: z.enum(["AC", "ELEKTRONIK"]),
  basePrice: z.number().nonnegative(),
  helperRate: z.number().min(0).max(100).default(0),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

async function list(req, res) {
  const { category } = req.query;
  const serviceTypes = await prisma.serviceType.findMany({
    where: { category: category || undefined },
    orderBy: { name: "asc" },
  });
  res.json(serviceTypes);
}

async function create(req, res) {
  const data = serviceTypeSchema.parse(req.body);
  const serviceType = await prisma.serviceType.create({ data });
  res.status(201).json(serviceType);
}

async function update(req, res) {
  const data = serviceTypeSchema.partial().parse(req.body);
  const serviceType = await prisma.serviceType.update({ where: { id: req.params.id }, data });
  res.json(serviceType);
}

async function remove(req, res) {
  await prisma.serviceType.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).send();
}

module.exports = { list, create, update, remove };
