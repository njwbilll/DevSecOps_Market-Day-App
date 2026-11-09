import { useEffect, useState } from 'react';
import { api, errText } from '../../api.js';
import { dateTime, rupiah } from '../../format.js';
import { Alert, Badge, Empty, PageHead } from '../../components/ui.jsx';

const TABS = [
  ['SUCCESS', 'Berhasil'],
  ['PENDING', 'Belum dibayar'],
  ['REJECTED', 'Gagal'],
];

export default function AdminTopupBook() {
  const [status, setStatus] = useState('SUCCESS');
  const [items, setItems] = useState(null);
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    setItems(null);
    setError('');
    api.get(`/admin/topups?status=${status}`).then((d) => { setItems(d.items); setSummary(d.summary); }).catch((x) => { setError(errText(x)); setItems([]); });
  }, [status]);

  return (
    <>
      <PageHead title="Top up masuk" sub="Top up tercatat otomatis saat pembayaran dikonfirmasi. Tidak perlu verifikasi manual." />

      <div className="tabs">
        {TABS.map(([v, label]) => (
          <button key={v} className={`tab ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{label}</button>
        ))}
      </div>

      <Alert>{error}</Alert>

      <section className="card card-black stat">
        <span>Total ({summary.count} transaksi)</span>
        <strong>{rupiah(summary.total)}</strong>
      </section>

      <section className="card card-white">
        {items && summary.count > items.length && (
          <p className="note">Menampilkan {items.length} dari {summary.count} top up terbaru.</p>
        )}
        {items === null ? (
          <div className="img-skeleton" />
        ) : items.length === 0 ? (
          <Empty title="Tidak ada data" text="Belum ada top up dengan status ini." />
        ) : (
          <ul className="list">
            {items.map((t) => (
              <li key={t.id} className="row">
                <span className="row-main">
                  <span className="row-title">{t.student.name} &middot; {rupiah(t.amount)}</span>
                  <span className="row-sub">
                    @{t.student.username} &middot; {t.method === 'BANK' ? 'Transfer bank' : 'E-wallet'} &middot; {dateTime(t.verifiedAt || t.createdAt)} &middot; {t.receiptNo}
                  </span>
                </span>
                <Badge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
