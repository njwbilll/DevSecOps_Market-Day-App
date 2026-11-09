import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../utils.js';
import { failTopup, settleTopup } from '../services/topup.js';

const router = Router();

const MAX_SKEW_SECONDS = 300; // toleransi selisih waktu 5 menit

const bodySchema = z.object({
  reference: z.string().min(6).max(40),
  status: z.enum(['PAID', 'FAILED', 'EXPIRED']),
  amount: z.coerce.number().int().positive(),
});

// Tanda tangan = HMAC-SHA256( "<timestamp>.<body mentah>" ). Timestamp ikut ditandatangani
// sehingga tidak bisa diganti untuk mengakali pengecekan replay.
function validSignature(rawBody, timestamp, signature) {
  if (!rawBody || !/^\d{10}$/.test(String(timestamp || '')) || !signature) return false;
  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/payment', async (req, res) => {
  const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
  const timestamp = req.get('x-timestamp');
  const signature = req.get('x-signature');

  // Setiap request dicatat, termasuk yang ditolak
  const log = (result, { valid = false, reference = null } = {}) =>
    prisma.webhookLog.create({
      data: { ip: req.ip, signatureValid: valid, reference, rawBody: raw.slice(0, 2000), result },
    });

  if (!validSignature(req.rawBody, timestamp, signature)) {
    await log('REJECTED_SIGNATURE');
    throw new HttpError(401, 'Tanda tangan tidak valid');
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
    await log('REJECTED_TIMESTAMP', { valid: true });
    throw new HttpError(401, 'Timestamp kedaluwarsa');
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    await log('REJECTED_BODY', { valid: true });
    throw new HttpError(400, 'Isi webhook tidak valid');
  }
  const { reference, status, amount } = parsed.data;

  const tx = await prisma.transaction.findUnique({ where: { reference } });
  if (!tx || tx.type !== 'TOPUP') {
    await log('REJECTED_UNKNOWN_REFERENCE', { valid: true, reference });
    throw new HttpError(404, 'Referensi tidak ditemukan');
  }
  if (tx.amount !== amount) {
    await log('REJECTED_AMOUNT_MISMATCH', { valid: true, reference });
    throw new HttpError(400, 'Nominal tidak sesuai');
  }

  if (status === 'PAID') {
    const r = await settleTopup(reference);
    await log(r.settled ? 'SETTLED' : 'ALREADY_PROCESSED', { valid: true, reference });
  } else {
    const changed = await failTopup(reference);
    await log(changed ? 'MARKED_FAILED' : 'ALREADY_PROCESSED', { valid: true, reference });
  }

  res.json({ ok: true });
});

export default router;
