import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { dateRange, wibDay } from '../utils.js';

const router = Router();

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() });

// Pencatatan keuangan otomatis dari setiap pembayaran yang masuk
router.get('/ledger', async (req, res) => {
  const q = querySchema.parse(req.query);
  const items = await prisma.transaction.findMany({
    where: {
      merchantId: req.user.id,
      type: 'PAYMENT',
      status: 'SUCCESS',
      createdAt: dateRange(q.from, q.to),
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: {
      id: true,
      receiptNo: true,
      amount: true,
      note: true,
      createdAt: true,
      student: { select: { name: true } },
    },
  });

  const today = wibDay(new Date());
  const byDay = new Map();
  let total = 0;
  let todayTotal = 0;
  let todayCount = 0;

  for (const it of items) {
    total += it.amount;
    const day = wibDay(it.createdAt);
    const cur = byDay.get(day) || { date: day, total: 0, count: 0 };
    cur.total += it.amount;
    cur.count += 1;
    byDay.set(day, cur);
    if (day === today) {
      todayTotal += it.amount;
      todayCount += 1;
    }
  }

  res.json({
    summary: { total, count: items.length, todayTotal, todayCount },
    daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    items,
  });
});

export default router;
