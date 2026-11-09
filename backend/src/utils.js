import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function receiptNo() {
  const d = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
  return `MD-${d}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Rentang tanggal berdasarkan zona waktu WIB (UTC+7)
export function dateRange(from, to) {
  const range = {};
  if (from) {
    if (!DAY.test(from)) throw new HttpError(400, 'Format tanggal awal harus YYYY-MM-DD');
    const d = new Date(`${from}T00:00:00+07:00`);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Tanggal awal tidak valid');
    range.gte = d;
  }
  if (to) {
    if (!DAY.test(to)) throw new HttpError(400, 'Format tanggal akhir harus YYYY-MM-DD');
    const d = new Date(`${to}T00:00:00+07:00`);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Tanggal akhir tidak valid');
    range.lt = new Date(d.getTime() + 86400000);
  }
  return Object.keys(range).length ? range : undefined;
}

export const wibDay = (d) => new Date(new Date(d).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

// Mencegah CSV/formula injection saat dibuka di Excel
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
