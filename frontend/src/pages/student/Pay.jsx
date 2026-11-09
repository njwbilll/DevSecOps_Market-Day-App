import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { api, errText } from '../../api.js';
import { dateTime, rupiah } from '../../format.js';
import Scanner from '../../components/Scanner.jsx';
import { Alert, Empty, Field, PageHead } from '../../components/ui.jsx';

const QUICK = [5000, 10000, 15000, 25000];

export default function Pay() {
  const { user, refresh } = useAuth();
  const [mode, setMode] = useState('scan');
  const [merchants, setMerchants] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    api.get('/merchants').then(setMerchants).catch(() => {});
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onScan(text) {
    if (!text.startsWith('MARKETDAY:')) {
      setError('QR ini bukan QR merchant Market Day.');
      return setScanKey((k) => k + 1);
    }
    try {
      const m = await api.get(`/merchants/code/${encodeURIComponent(text.slice(10))}`);
      setMerchant(m);
      setError('');
    } catch (x) {
      setError(errText(x));
      setScanKey((k) => k + 1);
    }
  }

  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= 1000;
  const enough = value <= user.balance;

  async function pay(e) {
    e.preventDefault();
    if (!valid) return setError('Minimal pembayaran Rp1.000');
    if (!enough) return setError('Saldo tidak cukup. Silakan top up terlebih dahulu.');
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/payments', { merchantId: merchant.id, amount: value, note: note.trim() || undefined });
      setReceipt(r);
      refresh().catch(() => {});
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setReceipt(null);
    setMerchant(null);
    setAmount('');
    setNote('');
    setError('');
    setScanKey((k) => k + 1);
  }

  // Bukti pembayaran
  if (receipt) {
    return (
      <>
        <PageHead title="Pembayaran berhasil" sub="Bukti pembayaran juga tersimpan di riwayat." />
        <section className="card card-black receipt">
          <span className="receipt-label">Dibayarkan ke {receipt.merchant?.name}</span>
          <strong className="receipt-amount">{rupiah(receipt.amount)}</strong>
          <dl>
            <div><dt>No. bukti</dt><dd>{receipt.receiptNo}</dd></div>
            <div><dt>Waktu</dt><dd>{dateTime(receipt.createdAt)}</dd></div>
            {receipt.note && <div><dt>Catatan</dt><dd>{receipt.note}</dd></div>}
            <div><dt>Sisa saldo</dt><dd>{rupiah(user.balance)}</dd></div>
          </dl>
        </section>
        <div className="grid-2">
          <button className="btn btn-red btn-block" onClick={reset}>Bayar lagi</button>
          <Link className="btn btn-ghost btn-block" to="/app">Selesai</Link>
        </div>
      </>
    );
  }

  // Konfirmasi nominal
  if (merchant) {
    return (
      <>
        <PageHead title="Nominal pembayaran" />
        <form className="card card-white stack" onSubmit={pay}>
          <div className="merchant-chip">
            <span className="avatar">{merchant.name.slice(0, 1)}</span>
            <span>
              <strong>{merchant.name}</strong>
              <small>Kode {merchant.merchantCode}</small>
            </span>
            <button type="button" className="link" onClick={reset}>Ganti</button>
          </div>

          <Alert>{error}</Alert>

          <Field label="Nominal" hint={`Saldo kamu ${rupiah(user.balance)}${amount ? ` · bayar ${rupiah(amount)}` : ''}`}>
            <input className="input input-lg" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))} autoFocus />
          </Field>
          <div className="chips">
            {QUICK.map((q) => (
              <button type="button" key={q} className={`chip ${value === q ? 'on' : ''}`} onClick={() => setAmount(String(q))}>{rupiah(q)}</button>
            ))}
          </div>
          <Field label="Catatan (opsional)">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="Contoh: es kopi susu 2" />
          </Field>

          <button className="btn btn-black btn-block" disabled={busy || !valid}>{busy ? 'Memproses...' : `Bayar ${valid ? rupiah(value) : ''}`}</button>
          {valid && !enough && <Link to="/app/topup" className="link center">Saldo kurang, top up sekarang</Link>}
        </form>
      </>
    );
  }

  // Pilih merchant
  return (
    <>
      <PageHead title="Bayar" sub="Scan QR di meja merchant atau pilih dari daftar." />
      <div className="tabs">
        <button className={`tab ${mode === 'scan' ? 'on' : ''}`} onClick={() => { setMode('scan'); setError(''); }}>Scan QR</button>
        <button className={`tab ${mode === 'list' ? 'on' : ''}`} onClick={() => { setMode('list'); setError(''); }}>Pilih merchant</button>
      </div>

      <Alert>{error}</Alert>

      {mode === 'scan' ? (
        <section className="card card-black scan-card">
          <Scanner key={scanKey} onResult={onScan} onError={() => setError('Kamera tidak dapat dibuka. Izinkan akses kamera dan buka lewat HTTPS, atau pilih merchant dari daftar.')} />
          <p className="scan-hint">Arahkan kamera ke QR merchant</p>
        </section>
      ) : (
        <section className="card card-white">
          {merchants.length === 0 ? (
            <Empty title="Belum ada merchant" text="Admin belum menambahkan merchant." />
          ) : (
            <ul className="list">
              {merchants.map((m) => (
                <li key={m.id}>
                  <button className="row row-btn" onClick={() => setMerchant(m)}>
                    <span className="avatar">{m.name.slice(0, 1)}</span>
                    <span className="row-main">
                      <span className="row-title">{m.name}</span>
                      <span className="row-sub">Kode {m.merchantCode}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
