import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError, csvCell, dateRange } from '../utils.js';

const router = Router();

// ---------- Verifikasi top up ----------
const listSchema = z.object({ status: z.enum(['PENDING', 'SUCCESS', 'REJECTED', 'ALL']).default('PENDING') });

router.get('/topups', async (req, res) => {
  const { status } = listSchema.parse(req.query);
  const items = await prisma.transaction.findMany({
    where: { type: 'TOPUP', status: status === 'ALL' ? undefined : status },
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 100,
    select: {
      id: true,
      receiptNo: true,
      status: true,
      amount: true,
      method: true,
      adminNote: true,
      createdAt: true,
      verifiedAt: true,
      student: { select: { name: true, username: true } },
      verifier: { select: { name: true } },
    },
  });
  res.json({ items });
});

const verifySchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(150).optional(),
});

router.post('/topups/:id/verify', async (req, res) => {
  const { approve, note } = verifySchema.parse(req.body);
  const id = req.params.id;

  // Saldo hanya bertambah jika pengajuan masih PENDING dan disetujui admin (atomik)
  await prisma.$transaction(async (db) => {
    const updated = await db.transaction.updateMany({
      where: { id, type: 'TOPUP', status: 'PENDING' },
      data: {
        status: approve ? 'SUCCESS' : 'REJECTED',
        verifiedById: req.user.id,
        verifiedAt: new Date(),
        adminNote: note || null,
      },
    });
    if (updated.count !== 1) throw new HttpError(409, 'Pengajuan tidak ditemukan atau sudah diproses');

    if (approve) {
      const t = await db.transaction.findUnique({ where: { id } });
      await db.wallet.update({
        where: { userId: t.studentId },
        data: { balance: { increment: t.amount } },
      });
    }
  });

  res.json({ message: approve ? 'Top up disetujui' : 'Top up ditolak' });
});

// ---------- Laporan rekap ----------
const reportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(['ALL', 'TOPUP', 'PAYMENT']).default('ALL'),
});

async function buildReport(query) {
  const q = reportSchema.parse(query);
  const rows = await prisma.transaction.findMany({
    where: {
      status: 'SUCCESS',
      type: q.type === 'ALL' ? undefined : q.type,
      createdAt: dateRange(q.from, q.to),
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      receiptNo: true,
      type: true,
      amount: true,
      method: true,
      createdAt: true,
      student: { select: { name: true, username: true } },
      merchant: { select: { name: true } },
    },
  });

  const summary = { topupTotal: 0, topupCount: 0, paymentTotal: 0, paymentCount: 0 };
  const merchants = new Map();
  for (const r of rows) {
    if (r.type === 'TOPUP') {
      summary.topupTotal += r.amount;
      summary.topupCount += 1;
    } else {
      summary.paymentTotal += r.amount;
      summary.paymentCount += 1;
      const name = r.merchant?.name || '-';
      const cur = merchants.get(name) || { name, total: 0, count: 0 };
      cur.total += r.amount;
      cur.count += 1;
      merchants.set(name, cur);
    }
  }
  const byMerchant = [...merchants.values()].sort((a, b) => b.total - a.total);
  return { rows, summary, byMerchant };
}

router.get('/report', async (req, res) => {
  res.json(await buildReport(req.query));
});

router.get('/report.csv', async (req, res) => {
  const { rows } = await buildReport(req.query);
  const head = ['No. Bukti', 'Waktu (WIB)', 'Jenis', 'Mahasiswa', 'Merchant', 'Metode', 'Jumlah (Rp)'];
  const lines = rows.map((r) =>
    [
      r.receiptNo,
      new Date(r.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      r.type === 'TOPUP' ? 'Top up' : 'Pembayaran',
      r.student?.name,
      r.merchant?.name,
      r.method,
      r.amount,
    ]
      .map(csvCell)
      .join(','),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="laporan-market-day.csv"');
  res.send('\uFEFF' + [head.map(csvCell).join(','), ...lines].join('\r\n'));
});

// ---------- Kelola merchant ----------
const merchantSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{4,20}$/, 'Username 4-20 karakter: huruf, angka, atau underscore'),
  name: z.string().trim().min(2).max(60),
  password: z.string().min(8).max(72),
  merchantCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,12}$/, 'Kode merchant 3-12 huruf atau angka'),
});

router.get('/merchants', async (req, res) => {
  const items = await prisma.user.findMany({
    where: { role: 'MERCHANT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, username: true, merchantCode: true, createdAt: true },
  });
  res.json({ items });
});

router.post('/merchants', async (req, res) => {
  const data = merchantSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const m = await prisma.user.create({
    data: { username: data.username, name: data.name, passwordHash, role: 'MERCHANT', merchantCode: data.merchantCode },
    select: { id: true, name: true, username: true, merchantCode: true, createdAt: true },
  });
  res.status(201).json(m);
});

export default router;
