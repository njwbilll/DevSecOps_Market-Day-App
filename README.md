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

1. Mahasiswa mengajukan top up (nominal, metode, foto bukti transfer).
2. Admin memeriksa bukti lalu menyetujui atau menolak. Saldo bertambah hanya jika disetujui.
3. Mahasiswa scan QR merchant (atau pilih dari daftar), isi nominal, bayar. Saldo berkurang dan bukti bayar muncul.
4. Pembayaran masuk ke pembukuan merchant secara otomatis.
5. Admin melihat laporan rekap dan mengunduh CSV.

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
| Validasi file berdasarkan isi, nama acak | `routes/student.js` (magic bytes JPG/PNG/WEBP, maksimal 2 MB) |
| Bukti transfer hanya untuk pemilik dan admin | `GET /api/topups/:id/proof` |
| Transaksi atomik (ACID) | `prisma.$transaction` pada pembayaran dan verifikasi top up |
| Anti double spend dan double verify | update bersyarat (`balance >= amount`, `status = PENDING`) |
| Non-repudiation | `receiptNo`, `verifiedById`, `verifiedAt`; tidak ada endpoint ubah atau hapus transaksi |
| Isolasi jaringan | `frontend_net` dan `data_net` (internal), IP statis sesuai Tabel 2.1 |
| CSV injection | `csvCell()` di `utils.js` |
| CI/CD | `.github/workflows/ci.yml` (build, CodeQL, Trivy, OWASP ZAP) |

## 6. Catatan

- Menggunakan `bcryptjs` (algoritma bcrypt versi JavaScript) agar build di image Alpine tidak membutuhkan kompilasi native.
- Skema database dibuat dengan `prisma db push` saat kontainer start. Untuk produksi, ganti dengan `prisma migrate`.
- Token disimpan di `localStorage`. CSP ketat dari Nginx mengurangi risiko XSS.
- Pada IP VM yang berbeda, tidak ada yang perlu diubah karena frontend memanggil `/api` lewat origin yang sama.
