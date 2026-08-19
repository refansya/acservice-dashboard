const { z } = require("zod");
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const technicianSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  specialty: z.array(z.enum(["AC", "ELEKTRONIK"])).min(1),
  status: z.enum(["AVAILABLE", "ON_DUTY", "OFF"]).optional(),
});

async function list(req, res) {
  const { specialty, status } = req.query;
  const technicians = await prisma.technician.findMany({
    where: {
      specialty: specialty ? { has: specialty } : undefined,
      status: status || undefined,
    },
    orderBy: { name: "asc" },
  });
  res.json(technicians);
}

async function getById(req, res) {
  const technician = await prisma.technician.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { orders: true, schedules: true },
  });
  res.json(technician);
}

async function create(req, res) {
  const data = technicianSchema.parse(req.body);
  const technician = await prisma.technician.create({ data });
  res.status(201).json(technician);
}

async function update(req, res) {
  const data = technicianSchema.partial().parse(req.body);
  const technician = await prisma.technician.update({ where: { id: req.params.id }, data });
  res.json(technician);
}

async function remove(req, res) {
  await prisma.technician.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

async function getSchedule(req, res) {
  const schedules = await prisma.technicianSchedule.findMany({
    where: { technicianId: req.params.id },
    orderBy: { date: "asc" },
  });
  res.json(schedules);
}

async function addSchedule(req, res) {
  const schema = z.object({ date: z.string(), note: z.string().optional() });
  const data = schema.parse(req.body);
  const schedule = await prisma.technicianSchedule.create({
    data: { technicianId: req.params.id, date: new Date(data.date), note: data.note },
  });
  res.status(201).json(schedule);
}

async function createAccount(req, res) {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const data = schema.parse(req.body);

  const technician = await prisma.technician.findUniqueOrThrow({ where: { id: req.params.id } });
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: technician.name,
      email: data.email,
      passwordHash,
      role: "TECHNICIAN",
      technicianId: technician.id,
    },
  });

  res.status(201).json({ id: user.id, email: user.email, role: user.role });
}

module.exports = { list, getById, create, update, remove, getSchedule, addSchedule, createAccount };
