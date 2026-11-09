function need(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Environment variable ${key} wajib diisi`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: need('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};

if (config.jwtSecret.length < 24) {
  throw new Error('JWT_SECRET minimal 24 karakter');
}
