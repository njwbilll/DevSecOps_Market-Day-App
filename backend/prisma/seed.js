import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { receiptNo } from '../src/utils.js';

const prisma = new PrismaClient();

function must(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Environment variable ${key} wajib diisi untuk seed`);
  return v;
}

async function ensureUser({ username, name, role, password, merchantCode }) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { user: existing, created: false };
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      username,
      name,
      role,
      passwordHash,
      merchantCode,
      ...(role === 'MAHASISWA' ? { wallet: { create: { balance: 0 } } } : {}),
    },
  });
  return { user, created: true };
}

async function main() {
  const { user: admin } = await ensureUser({
    username: 'admin',
    name: 'Admin Market Day',
    role: 'ADMIN',
    password: must('SEED_ADMIN_PASSWORD'),
  });

  if (process.env.SEED_DEMO_DATA !== 'true') return;
  const demoPassword = must('SEED_DEMO_PASSWORD');

  await ensureUser({ username: 'kopi_kampus', name: 'Kopi Kampus', role: 'MERCHANT', password: demoPassword, merchantCode: 'KOPI01' });
  await ensureUser({ username: 'geprek88', name: 'Ayam Geprek 88', role: 'MERCHANT', password: demoPassword, merchantCode: 'GEPREK88' });

  const { user: student, created } = await ensureUser({
    username: 'mahasiswa',
    name: 'Mahasiswa Demo',
    role: 'MAHASISWA',
    password: demoPassword,
  });

  if (created) {
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: student.id }, data: { balance: { increment: 50000 } } }),
      prisma.transaction.create({
        data: {
          receiptNo: receiptNo(),
          type: 'TOPUP',
          status: 'SUCCESS',
          amount: 50000,
          method: 'BANK',
          studentId: student.id,
          verifiedById: admin.id,
          verifiedAt: new Date(),
          adminNote: 'Saldo awal demo',
        },
      }),
    ]);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
