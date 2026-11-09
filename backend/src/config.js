function need(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Environment variable ${key} wajib diisi`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: need('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  // sandbox: tombol simulasi pembayaran aktif. live: hanya webhook payment gateway.
  paymentMode: process.env.PAYMENT_MODE === 'live' ? 'live' : 'sandbox',
  webhookSecret: need('PAYMENT_WEBHOOK_SECRET'),
};

if (config.jwtSecret.length < 24) {
  throw new Error('JWT_SECRET minimal 24 karakter');
}
if (config.webhookSecret.length < 16) {
  throw new Error('PAYMENT_WEBHOOK_SECRET minimal 16 karakter');
}
