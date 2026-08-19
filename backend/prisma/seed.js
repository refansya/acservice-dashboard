const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@projectid.services" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@projectid.services",
      passwordHash,
      role: "ADMIN",
    },
  });

  const services = [
    {
      code: "INS",
      name: "Instalasi",
      category: "AC",
      basePrice: 150000,
      helperRate: 15,
    },
    {
      code: "MNT",
      name: "Maintenance",
      category: "AC",
      basePrice: 250000,
      helperRate: 10,
    },
    {
      code: "SRV",
      name: "Service",
      category: "AC",
      basePrice: 300000,
      helperRate: 15,
    },
    {
      code: "TV",
      name: "Perbaikan TV LED",
      category: "ELEKTRONIK",
      basePrice: 100000,
      helperRate: 0,
    },
    {
      code: "MC",
      name: "Perbaikan Mesin Cuci",
      category: "ELEKTRONIK",
      basePrice: 120000,
      helperRate: 0,
    },
    {
      code: "KLS",
      name: "Perbaikan Kulkas",
      category: "ELEKTRONIK",
      basePrice: 130000,
      helperRate: 0,
    },
  ];

  for (const s of services) {
    await prisma.serviceType
      .upsert({
        where: { name: s.name },
        update: { code: s.code, helperRate: s.helperRate },
        create: s,
      })
      .catch(async () => {
        // fallback kalau field name belum unique di schema
        const exists = await prisma.serviceType.findFirst({
          where: { name: s.name },
        });
        if (!exists) await prisma.serviceType.create({ data: s });
      });
  }

  const technician = await prisma.technician.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Budi Santoso",
      phone: "081234567890",
      specialty: ["AC", "ELEKTRONIK"],
    },
  });

  const techPasswordHash = await bcrypt.hash("teknisi123", 10);
  await prisma.user.upsert({
    where: { email: "budi@projectid.services" },
    update: {},
    create: {
      name: technician.name,
      email: "budi@projectid.services",
      passwordHash: techPasswordHash,
      role: "TECHNICIAN",
      technicianId: technician.id,
    },
  });

  console.log("Seed selesai.");
  console.log("Login admin: admin@projectid.services / admin123");
  console.log("Login teknisi: budi@projectid.services / teknisi123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
