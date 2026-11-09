import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../utils.js';

// Lapisan payment gateway.
// Proses 2.2 memanggil createCharge() sebagai "permintaan tagihan" dan menerima "kode pembayaran".
// Konfirmasi pembayaran dari gateway masuk lewat webhook (routes/webhooks.js).

const digits = (n) => Array.from({ length: n }, () => crypto.randomInt(0, 10)).join('');

// Mode sandbox: gateway disimulasikan di backend, tanpa koneksi keluar.
async function sandboxCharge({ method }) {
  const code = method === 'BANK' ? `8808${digits(10)}` : `EW${digits(10)}`;
  return { reference: code, paymentCode: code };
}

// Mode live: kerangka integrasi, belum terhubung ke gateway mana pun.
// Isi dengan pemanggilan API gateway (misalnya Midtrans Core API /v2/charge atau Xendit)
// memakai kunci server dari environment variable, kirim orderId sebagai order ID, lalu kembalikan:
//   reference   = order ID di gateway (dipakai webhook untuk mencocokkan tagihan)
//   paymentCode = nomor virtual account atau kode e-wallet yang diterbitkan gateway
// Format tanda tangan webhook milik gateway disesuaikan di routes/webhooks.js.
// eslint-disable-next-line no-unused-vars
async function liveCharge({ amount, method, orderId }) {
  throw new HttpError(501, 'Integrasi payment gateway live belum dikonfigurasi');
}

export function createCharge(params) {
  return config.paymentMode === 'sandbox' ? sandboxCharge(params) : liveCharge(params);
}
