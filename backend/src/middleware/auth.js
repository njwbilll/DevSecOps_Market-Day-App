import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Verifikasi tanda tangan token pada setiap request
export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi berakhir, silakan masuk kembali' });
  }
}

// RBAC di backend
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Akses ditolak' });
