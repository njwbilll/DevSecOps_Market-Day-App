import { prisma } from '../db.js';

// Dipanggil saat pembayaran top up terkonfirmasi. Aman dipanggil berulang (idempoten):
// saldo hanya bertambah sekali karena update hanya berlaku jika status masih PENDING.
export async function settleTopup(reference) {
  return prisma.$transaction(async (db) => {
    const updated = await db.transaction.updateMany({
      where: { reference, type: 'TOPUP', status: 'PENDING' },
      data: { status: 'SUCCESS', verifiedAt: new Date() },
    });
    if (updated.count !== 1) return { settled: false };

    const tx = await db.transaction.findUnique({ where: { reference } });
    await db.wallet.update({
      where: { userId: tx.studentId },
      data: { balance: { increment: tx.amount } },
    });
    return { settled: true, tx };
  });
}

export async function failTopup(reference) {
  const r = await prisma.transaction.updateMany({
    where: { reference, type: 'TOPUP', status: 'PENDING' },
    data: { status: 'REJECTED', verifiedAt: new Date() },
  });
  return r.count === 1;
}
