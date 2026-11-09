import { useEffect, useState } from 'react';
import { api, errText } from '../../api.js';
import { Alert, Empty, PageHead, TxRow } from '../../components/ui.jsx';

const TYPES = [
  ['', 'Semua'],
  ['PAYMENT', 'Pembayaran'],
  ['TOPUP', 'Top up'],
];

export default function History() {
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setItems(null);
    const q = new URLSearchParams({ limit: '100' });
    if (type) q.set('type', type);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api.get(`/transactions?${q}`).then((d) => setItems(d.items)).catch((x) => { setError(errText(x)); setItems([]); });
  }, [type, from, to]);

  return (
    <>
      <PageHead title="Riwayat" sub="Pembayaran ke merchant dan top up yang sudah diverifikasi admin." />

      <section className="card card-white stack">
        <div className="chips">
          {TYPES.map(([v, label]) => (
            <button key={v} className={`chip ${type === v ? 'on' : ''}`} onClick={() => setType(v)}>{label}</button>
          ))}
        </div>
        <div className="grid-2">
          <label className="field"><span className="field-label">Dari tanggal</span><input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span className="field-label">Sampai tanggal</span><input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </section>

      <section className="card card-white">
        <Alert>{error}</Alert>
        {items === null ? (
          <div className="img-skeleton" />
        ) : items.length === 0 ? (
          <Empty title="Tidak ada transaksi" text="Ubah filter atau lakukan transaksi pertama kamu." />
        ) : (
          <ul className="list">{items.map((t) => <TxRow key={t.id} tx={t} />)}</ul>
        )}
      </section>
    </>
  );
}
