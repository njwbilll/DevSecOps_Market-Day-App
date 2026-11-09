import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, dateRange, receiptNo } from '../utils.js';

const router = Router();
const student = requireRole('MAHASISWA');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 5 },
});

const txSelect = {
  id: true,
  receiptNo: true,
  type: true,
  status: true,
  amount: true,
  method: true,
  note: true,
  adminNote: true,
  createdAt: true,
  verifiedAt: true,
  merchant: { select: { name: true, merchantCode: true } },
};

// Validasi tipe file berdasarkan isi (magic bytes), bukan ekstensi dari pengguna
function detectImageExt(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null;
}

// Profil dan saldo (semua role)
router.get('/me', async (req, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, username: true, role: true, merchantCode: true, wallet: { select: { balance: true } } },
  });
  if (!u) throw new HttpError(401, 'Akun tidak ditemukan');
  const { wallet, ...rest } = u;
  res.json({ ...rest, balance: wallet?.balance ?? 0 });
});

router.get('/merchants', student, async (req, res) => {
  const list = await prisma.user.findMany({
    where: { role: 'MERCHANT' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, merchantCode: true },
  });
  res.json(list);
});

router.get('/merchants/code/:code', student, async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().slice(0, 20);
  const m = await prisma.user.findFirst({
    where: { role: 'MERCHANT', merchantCode: code },
    select: { id: true, name: true, merchantCode: true },
  });
  if (!m) throw new HttpError(404, 'Merchant tidak ditemukan');
  res.json(m);
});

// ---------- Top up ----------
const topupSchema = z.object({
  amount: z.coerce.number().int('Nominal harus bilangan bulat').min(10000, 'Minimal top up Rp10.000').max(1000000, 'Maksimal top up Rp1.000.000'),
  method: z.enum(['BANK', 'EWALLET']),
});

router.get('/topups', student, async (req, res) => {
  const items = await prisma.transaction.findMany({
    where: { studentId: req.user.id, type: 'TOPUP' },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: txSelect,
  });
  res.json({ items });
});

router.post('/topups', student, upload.single('proof'), async (req, res) => {
  const data = topupSchema.parse(req.body);
  if (!req.file) throw new HttpError(400, 'Bukti transfer wajib diunggah');
  const ext = detectImageExt(req.file.buffer);
  if (!ext) throw new HttpError(400, 'File harus berupa gambar JPG, PNG, atau WEBP');

  const pending = await prisma.transaction.count({
    where: { studentId: req.user.id, type: 'TOPUP', status: 'PENDING' },
  });
  if (pending >= 5) throw new HttpError(429, 'Masih ada 5 pengajuan yang menunggu verifikasi');

  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.resolve(config.uploadDir, fileName);
  await fs.writeFile(filePath, req.file.buffer, { mode: 0o640 });

  try {
    const tx = await prisma.transaction.create({
      data: {
        receiptNo: receiptNo(),
        type: 'TOPUP',
        status: 'PENDING',
        amount: data.amount,
        method: data.method,
        proofPath: fileName,
        studentId: req.user.id,
      },
      select: txSelect,
    });
    res.status(201).json(tx);
  } catch (e) {
    await fs.unlink(filePath).catch(() => {});
    throw e;
  }
});

// Bukti transfer hanya dapat dilihat pemilik atau admin
router.get('/topups/:id/proof', async (req, res) => {
  const t = await prisma.transaction.findFirst({ where: { id: req.params.id, type: 'TOPUP' } });
  if (!t || !t.proofPath) throw new HttpError(404, 'Bukti tidak ditemukan');
  if (req.user.role !== 'ADMIN' && t.studentId !== req.user.id) throw new HttpError(403, 'Akses ditolak');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(path.resolve(config.uploadDir, path.basename(t.proofPath)));
});

// ---------- Pembayaran ----------
const paySchema = z.object({
  merchantId: z.string().uuid(),
  amount: z.coerce.number().int('Nominal harus bilangan bulat').min(1000, 'Minimal pembayaran Rp1.000').max(2000000),
  note: z.string().trim().max(100).optional(),
});

router.post('/payments', student, async (req, res) => {
  const { merchantId, amount, note } = paySchema.parse(req.body);

  // Pengurangan saldo dan pencatatan transaksi dijalankan atomik
  const tx = await prisma.$transaction(async (db) => {
    const merchant = await db.user.findFirst({ where: { id: merchantId, role: 'MERCHANT' } });
    if (!merchant) throw new HttpError(404, 'Merchant tidak ditemukan');

    const updated = await db.wallet.updateMany({
      where: { userId: req.user.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (updated.count !== 1) throw new HttpError(400, 'Saldo tidak cukup');

    return db.transaction.create({
      data: {
        receiptNo: receiptNo(),
        type: 'PAYMENT',
        status: 'SUCCESS',
        amount,
        note: note || null,
        studentId: req.user.id,
        merchantId,
      },
      select: txSelect,
    });
  });
  res.status(201).json(tx);
});

// ---------- Riwayat (pembayaran dan top up yang sudah diverifikasi) ----------
const historySchema = z.object({
  type: z.enum(['TOPUP', 'PAYMENT']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/transactions', student, async (req, res) => {
  const q = historySchema.parse(req.query);
  const items = await prisma.transaction.findMany({
    where: {
      studentId: req.user.id,
      status: 'SUCCESS',
      type: q.type,
      createdAt: dateRange(q.from, q.to),
    },
    orderBy: { createdAt: 'desc' },
    take: q.limit,
    select: txSelect,
  });
  res.json({ items });
});

export default router;
