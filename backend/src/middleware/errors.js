import { ZodError } from 'zod';
import { HttpError } from '../utils.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Input tidak valid',
      details: err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`),
    });
  }
  if (err?.code === 'P2002') return res.status(409).json({ error: 'Data sudah terdaftar' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format JSON tidak valid' });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
}
