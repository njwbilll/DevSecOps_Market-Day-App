import { prisma } from '../db.js';

// Mencatat aksi sensitif admin. Tabel AdminLog append-only (dijaga trigger database).
export function logAdmin(req, action, detail) {
  return prisma.adminLog.create({
    data: { adminId: req.user.id, action, detail: detail ?? null, ip: req.ip },
  });
}
