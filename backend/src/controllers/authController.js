const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../config/prisma");

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "STAFF", "TECHNICIAN", "HELPER"]).optional(),
  technicianId: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function register(req, res) {
  const data = registerSchema.parse(req.body);

  if (data.role === "TECHNICIAN" && !data.technicianId) {
    return res.status(400).json({ error: "technicianId wajib diisi untuk akun TECHNICIAN" });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role || "STAFF",
      technicianId: data.role === "TECHNICIAN" ? data.technicianId : undefined,
    },
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
}

async function login(req, res) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    return res.status(401).json({ error: "Email atau password salah" });
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Email atau password salah" });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, name: user.name, technicianId: user.technicianId || null, helperId: user.helperId || null },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, technicianId: user.technicianId, helperId: user.helperId },
  });
}

module.exports = { register, login };
