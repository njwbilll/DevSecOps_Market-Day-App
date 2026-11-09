import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { csvCell, dateRange } from '../utils.js';
import { logAdmin } from '../services/audit.js';

const router = Router();

// ---------- Pembukuan top up (otomatis, hanya dibaca) ----------
const listSchema = z.object({ status: z.enum(['PENDING', 'SUCCESS', 'REJECTED', 'ALL']).default('SUCCESS') });

router.get('/topups', async (req, res) => {
  const { status } = listSchema.parse(req.query);
  const where = { type: 'TOPUP', status: status === 'ALL' ? undefined : status };
  const [items, agg] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        receiptNo: true,
        status: true,
        amount: true,
        method: true,
        reference: true,
        createdAt: true,
        verifiedAt: true,
        student: { select: { name: true, username: true } },
      },
    }),
    prisma.transaction.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  res.json({ items, summary: { total: agg._sum.amount || 0, count: agg._count._all } });
});

// ---------- Laporan rekap ----------
const reportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(['ALL', 'TOPUP', 'PAYMENT']).default('ALL'),
});

const VIEW_LIMIT = 500;
const CSV_LIMIT = 50000;

// Total dihitung di database (groupBy), sedangkan daftar baris dibatasi agar respons tetap ringan.
async function buildReport(query, limit) {
  const q = reportSchema.parse(query);
  const where = {
    status: 'SUCCESS',
    type: q.type === 'ALL' ? undefined : q.type,
    createdAt: dateRange(q.from, q.to),
  };
  const sum = { _sum: { amount: true }, _count: { _all: true } };

  const [rows, byType, byMerchantRaw] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        receiptNo: true,
        type: true,
        amount: true,
        method: true,
        createdAt: true,
        student: { select: { name: true, username: true } },
        merchant: { select: { name: true } },
      },
    }),
    prisma.transaction.groupBy({ by: ['type'], where, ...sum }),
    q.type === 'TOPUP'
      ? []
      : prisma.transaction.groupBy({ by: ['merchantId'], where: { ...where, type: 'PAYMENT' }, ...sum }),
  ]);

  const summary = { topupTotal: 0, topupCount: 0, paymentTotal: 0, paymentCount: 0 };
  for (const g of byType) {
    if (g.type === 'TOPUP') {
      summary.topupTotal = g._sum.amount || 0;
      summary.topupCount = g._count._all;
    } else {
      summary.paymentTotal = g._sum.amount || 0;
      summary.paymentCount = g._count._all;
    }
  }

  const ids = byMerchantRaw.map((g) => g.merchantId).filter(Boolean);
  const names = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(names.map((u) => [u.id, u.name]));
  const byMerchant = byMerchantRaw
    .filter((g) => g.merchantId)
    .map((g) => ({ name: nameOf.get(g.merchantId) || '-', total: g._sum.amount || 0, count: g._count._all }))
    .sort((a, b) => b.total - a.total);

  const totalRows = summary.topupCount + summary.paymentCount;
  return { rows, summary, byMerchant, totalRows, truncated: totalRows > rows.length };
}

router.get('/report', async (req, res) => {
  res.json(await buildReport(req.query, VIEW_LIMIT));
});

router.get('/report.csv', async (req, res) => {
  const { rows } = await buildReport(req.query, CSV_LIMIT);
  await logAdmin(req, 'REPORT_EXPORT', `from=${req.query.from || '-'} to=${req.query.to || '-'} type=${req.query.type || 'ALL'} baris=${rows.length}`);
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
  await logAdmin(req, 'MERCHANT_CREATE', `${m.username} (${m.merchantCode})`);
  res.status(201).json(m);
});

export default router;
