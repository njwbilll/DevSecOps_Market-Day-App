# Aplikasi Market Day

Aplikasi Market Day berbasis web untuk otomatisasi transaksi dan pencatatan keuangan terintegrasi. Stack: React (Vite) + Nginx, Node.js + Express, Prisma, PostgreSQL 16, Docker Compose.

## 1. Mengembalikan ekstensi file

Semua file dikirim berekstensi `.txt`. Setelah di-extract, jalankan di dalam folder proyek:

```bash
find . -type f -name "*.txt" | while read f; do mv "$f" "${f%.txt}"; done
```

## 2. Menjalankan di VM Ubuntu Server (Docker)

```bash
cp .env.example .env
nano .env                      # ganti semua password dan JWT_SECRET
docker compose up -d --build
docker compose logs -f backend # tunggu pesan "Market Day API berjalan"
```

Buka `https://IP-VM` dari ponsel atau laptop pada Wi-Fi yang sama. Browser akan menampilkan peringatan sertifikat karena memakai self-signed, pilih lanjutkan. HTTPS wajib agar kamera untuk scan QR dapat dipakai.

Akun awal (dari `.env`):

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | nilai `SEED_ADMIN_PASSWORD` |
| Merchant | `kopi_kampus`, `geprek88` | nilai `SEED_DEMO_PASSWORD` |
| Mahasiswa | `mahasiswa` (saldo awal Rp50.000) | nilai `SEED_DEMO_PASSWORD` |

Set `SEED_DEMO_DATA=false` jika tidak ingin akun demo. Mahasiswa baru mendaftar sendiri lewat halaman Daftar, merchant ditambahkan admin.

## 3. Mode pengembangan (tanpa Docker)

```bash
# terminal 1: butuh PostgreSQL lokal
cd backend && npm install
export DATABASE_URL="postgresql://user:pass@localhost:5432/marketday"
export JWT_SECRET="string_acak_minimal_24_karakter"
export SEED_ADMIN_PASSWORD="Admin12345" SEED_DEMO_DATA=true SEED_DEMO_PASSWORD="Demo12345"
npx prisma generate && npx prisma db push && npm run seed && npm run dev

# terminal 2
cd frontend && npm install && npm run dev
```

## 4. Alur utama

1. Mahasiswa membuat tagihan top up (nominal dan metode), lalu membayar lewat bank (virtual account) atau e-wallet.
2. Payment gateway mengirim konfirmasi ke `POST /api/webhooks/payment`. Saldo bertambah dan top up tercatat otomatis, tanpa verifikasi admin.
3. Mahasiswa scan QR merchant (atau pilih dari daftar), isi nominal, bayar. Saldo berkurang dan bukti bayar muncul.
4. Pembayaran masuk ke pembukuan merchant secara otomatis.
5. Admin memantau top up masuk dan laporan rekap, serta mengunduh CSV.

Permintaan tagihan dan kode pembayaran ditangani oleh `backend/src/services/gateway.js`. Mode `PAYMENT_MODE=sandbox` (bawaan) mensimulasikan gateway di backend dan menampilkan tombol simulasi pembayaran untuk demo. Mode `live` baru berupa kerangka: isi fungsi `liveCharge()` dengan pemanggilan API gateway (misalnya Midtrans atau Xendit) dan sesuaikan verifikasi webhook di `routes/webhooks.js`. Selama belum diisi, pembuatan tagihan pada mode `live` mengembalikan galat 501.

Uji webhook manual (tanda tangan mencakup timestamp, request lebih dari 5 menit ditolak):

```bash
TS=$(date +%s)
BODY='{"reference":"KODE_PEMBAYARAN_DI_HALAMAN_TOP_UP","status":"PAID","amount":50000}'
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "ISI_PAYMENT_WEBHOOK_SECRET" | awk '{print $2}')
curl -k -X POST https://IP-VM/api/webhooks/payment \
  -H "Content-Type: application/json" -H "x-timestamp: $TS" -H "x-signature: $SIG" -d "$BODY"
```

Lihat audit log webhook dan aksi admin:

```bash
docker compose exec postgres psql -U marketday -d marketday -c 'SELECT "createdAt","result","reference","ip" FROM "WebhookLog" ORDER BY "createdAt" DESC LIMIT 10;'
docker compose exec postgres psql -U marketday -d marketday -c 'SELECT "createdAt","action","detail" FROM "AdminLog" ORDER BY "createdAt" DESC LIMIT 10;'
```

## 5. Pemetaan ke PRD dan threat model

| Kontrol | Implementasi |
|---|---|
| HTTPS, redirect 80 ke 443 | `frontend/nginx.conf` |
| Rate limiting dan batas ukuran request | Nginx (`limit_req`, `client_max_body_size`) dan `express-rate-limit` |
| Password hash | bcrypt (paket `bcryptjs`, cost 12) |
| JWT berdurasi singkat, RBAC | `middleware/auth.js`, signature diverifikasi setiap request |
| Role mahasiswa dipaksa di server | `routes/auth.js` (role tidak diambil dari input) |
| Validasi input | zod di setiap endpoint |
| SQL injection | Prisma (parameterized query) |
| Webhook tidak bisa dipalsukan | `routes/webhooks.js` (HMAC-SHA256 atas body mentah, `timingSafeEqual`, cek kecocokan nominal) |
| Konfirmasi ganda tidak menambah saldo dua kali | `services/topup.js` (update bersyarat `status = PENDING`, idempoten) |
| Transaksi atomik (ACID) | `prisma.$transaction` pada pembayaran dan verifikasi top up |
| Anti double spend | update bersyarat (`balance >= amount`) dan CHECK constraint `balance >= 0` di database |
| Transaksi sukses tidak dapat diubah atau dihapus | trigger PostgreSQL `md_tx_immutable` (`prisma/hardening.sql`) |
| Audit log webhook dan aksi admin (append-only) | tabel `WebhookLog` dan `AdminLog`, dijaga trigger (tanpa UPDATE, DELETE, TRUNCATE) |
| Non-repudiation | `receiptNo`, `reference`, `verifiedAt` (waktu konfirmasi); tidak ada endpoint ubah atau hapus transaksi |
| Isolasi jaringan | `frontend_net` dan `data_net` (internal), IP statis sesuai Tabel 2.1 |
| CSV injection | `csvCell()` di `utils.js` |
| CI/CD | `.github/workflows/ci.yml` (build, CodeQL, Trivy, OWASP ZAP) |

## 6. Catatan

- Menggunakan `bcryptjs` (algoritma bcrypt versi JavaScript) agar build di image Alpine tidak membutuhkan kompilasi native.
- Skema database dibuat dengan `prisma db push` saat kontainer start. Untuk produksi, ganti dengan `prisma migrate`.
- Token disimpan di `localStorage`. CSP ketat dari Nginx mengurangi risiko XSS.
- Pada IP VM yang berbeda, tidak ada yang perlu diubah karena frontend memanggil `/api` lewat origin yang sama.
