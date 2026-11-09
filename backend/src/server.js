import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs/promises';
import { config } from './config.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import merchantRoutes from './routes/merchant.js';
import adminRoutes from './routes/admin.js';

await fs.mkdir(config.uploadDir, { recursive: true });

const app = express();
app.set('trust proxy', 1); // di belakang Nginx
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.use(
  '/api',
  rateLimit({ windowMs: 60_000, limit: 200, standardHeaders: true, legacyHeaders: false }),
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak percobaan, coba lagi beberapa menit lagi' },
  }),
  authRoutes,
);
app.use('/api/admin', authenticate, requireRole('ADMIN'), adminRoutes);
app.use('/api/merchant', authenticate, requireRole('MERCHANT'), merchantRoutes);
app.use('/api', authenticate, studentRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => console.log(`Market Day API berjalan di port ${config.port}`));
