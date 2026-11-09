import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../utils.js';

const router = Router();

// Hash palsu agar waktu respons login tidak membocorkan username yang valid
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{4,20}$/, 'Username 4-20 karakter: huruf, angka, atau underscore'),
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(60),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72),
});

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(40),
  password: z.string().min(1).max(72),
});

// Registrasi hanya untuk Mahasiswa. Merchant dibuat oleh Admin.
router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { username: data.username } });
  if (exists) throw new HttpError(409, 'Username sudah dipakai');

  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.user.create({
    data: {
      username: data.username,
      name: data.name,
      passwordHash,
      role: 'MAHASISWA',
      wallet: { create: { balance: 0 } },
    },
  });
  res.status(201).json({ message: 'Pendaftaran berhasil, silakan masuk' });
});

router.post('/login', async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Username atau password salah');

  const token = jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
  });
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
});

export default router;
