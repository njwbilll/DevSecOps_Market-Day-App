import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { settleTopup } from '../services/topup.js';
import { createCharge } from '../services/gateway.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError, dateRange, receiptNo } from '../utils.js';

const router = Router();
const student = requireRole('MAHASISWA');

const txSelect = {
  id: true,
  receiptNo: true,
  type: true,
  status: true,
  amount: true,
  method: true,
  reference: true,
  paymentCode: true,
  note: true,
  adminNote: true,
  createdAt: true,
  verifiedAt: true,
  merchant: { select: { name: true, merchantCode: true } },
};

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

// ---------- Top up otomatis ----------
// Pembeli membayar lewat bank atau e-wallet. Saldo bertambah dan tercatat otomatis
// saat payment gateway mengirim konfirmasi (webhook). Tidak ada verifikasi manual admin.
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
  res.json({ items, sandbox: config.paymentMode === 'sandbox' });
});

router.post('/topups', student, async (req, res) => {
  const data = topupSchema.parse(req.body);

  // Tagihan yang tidak dibayar lebih dari 24 jam dianggap kedaluwarsa
  await prisma.transaction.updateMany({
    where: { studentId: req.user.id, type: 'TOPUP', status: 'PENDING', createdAt: { lt: new Date(Date.now() - 86400000) } },
    data: { status: 'REJECTED' },
  });

  const pending = await prisma.transaction.count({
    where: { studentId: req.user.id, type: 'TOPUP', status: 'PENDING' },
  });
  if (pending >= 3) throw new HttpError(429, 'Masih ada 3 tagihan top up yang belum dibayar');

  // Permintaan tagihan ke payment gateway, balasannya berisi kode pembayaran
  const receipt = receiptNo();
  const charge = await createCharge({ amount: data.amount, method: data.method, orderId: receipt });

  const tx = await prisma.transaction.create({
    data: {
      receiptNo: receipt,
      type: 'TOPUP',
      status: 'PENDING',
      amount: data.amount,
      method: data.method,
      reference: charge.reference,
      paymentCode: charge.paymentCode,
      studentId: req.user.id,
    },
    select: txSelect,
  });
  res.status(201).json({ ...tx, sandbox: config.paymentMode === 'sandbox' });
});

// Hanya untuk mode sandbox: meniru konfirmasi dari payment gateway
router.post('/topups/:id/simulate-pay', student, async (req, res) => {
  if (config.paymentMode !== 'sandbox') throw new HttpError(404, 'Endpoint tidak ditemukan');
  const t = await prisma.transaction.findFirst({
    where: { id: req.params.id, type: 'TOPUP', studentId: req.user.id },
  });
  if (!t || !t.reference) throw new HttpError(404, 'Tagihan tidak ditemukan');
  const r = await settleTopup(t.reference);
  if (!r.settled) throw new HttpError(409, 'Tagihan sudah diproses');
  res.json({ message: 'Pembayaran berhasil disimulasikan' });
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
