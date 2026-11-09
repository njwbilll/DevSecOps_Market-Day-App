import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { dateRange, wibDay } from '../utils.js';

const router = Router();

const LIST_LIMIT = 500;
const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() });

// Rekap per hari (zona WIB, UTC+7) dihitung di database, bukan dari daftar yang dibatasi.
async function dailyTotals(merchantId, range) {
  const gte = range?.gte ? Prisma.sql`AND "createdAt" >= ${range.gte.toISOString()}::timestamp` : Prisma.empty;
  const lt = range?.lt ? Prisma.sql`AND "createdAt" < ${range.lt.toISOString()}::timestamp` : Prisma.empty;
  const rows = await prisma.$queryRaw`
    SELECT to_char(("createdAt" + interval '7 hours')::date, 'YYYY-MM-DD') AS date,
           SUM("amount")::bigint AS total,
           COUNT(*)::bigint AS count
    FROM "Transaction"
    WHERE "merchantId" = ${merchantId} AND "type" = 'PAYMENT' AND "status" = 'SUCCESS' ${gte} ${lt}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((r) => ({ date: r.date, total: Number(r.total), count: Number(r.count) }));
}

// Pencatatan keuangan otomatis dari setiap pembayaran yang masuk
router.get('/ledger', async (req, res) => {
  const q = querySchema.parse(req.query);
  const base = { merchantId: req.user.id, type: 'PAYMENT', status: 'SUCCESS' };
  const range = dateRange(q.from, q.to);
  const today = wibDay(new Date());
  const sum = { _sum: { amount: true }, _count: { _all: true } };

  const [agg, todayAgg, items, daily] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...base, createdAt: range }, ...sum }),
    prisma.transaction.aggregate({ where: { ...base, createdAt: dateRange(today, today) }, ...sum }),
    prisma.transaction.findMany({
      where: { ...base, createdAt: range },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      select: {
        id: true,
        receiptNo: true,
        amount: true,
        note: true,
        createdAt: true,
        student: { select: { name: true } },
      },
    }),
    dailyTotals(req.user.id, range),
  ]);

  res.json({
    summary: {
      total: agg._sum.amount || 0,
      count: agg._count._all,
      todayTotal: todayAgg._sum.amount || 0,
      todayCount: todayAgg._count._all,
    },
    daily,
    items,
  });
});

export default router;
