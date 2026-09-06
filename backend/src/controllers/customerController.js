const { z } = require("zod");
const prisma = require("../config/prisma");

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  address: z.string().optional(),
  notes: z.string().optional(),
});

async function list(req, res) {
  const { search } = req.query;
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(customers);
}

async function getById(req, res) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { orders: true },
  });
  res.json(customer);
}

async function create(req, res) {
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({ data });
  res.status(201).json(customer);
}

async function update(req, res) {
  const data = customerSchema.partial().parse(req.body);
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data,
  });
  res.json(customer);
}

async function remove(req, res) {
  // Cegah hapus pelanggan yang masih punya order tercatat - kalau dipaksa,
  // Postgres akan menolak dengan foreign key error yang mentah dan
  // membingungkan. Di sini kita cek dulu dan kasih pesan yang jelas.
  const orderCount = await prisma.order.count({
    where: { customerId: req.params.id },
  });
  if (orderCount > 0) {
    return res.status(400).json({
      error: `Tidak bisa dihapus: pelanggan ini masih punya ${orderCount} order tercatat. Hapus order-order tersebut dulu kalau memang mau menghapus pelanggan ini.`,
    });
  }
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = { list, getById, create, update, remove };
