import { useEffect, useState } from 'react';
import { api, errText } from '../../api.js';
import { addDays, rupiah, todayWIB } from '../../format.js';
import { Alert, Empty, PageHead, TxRow } from '../../components/ui.jsx';

export default function MerchantLedger() {
  const [from, setFrom] = useState(addDays(todayWIB(), -29));
  const [to, setTo] = useState(todayWIB());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/merchant/ledger?from=${from}&to=${to}`).then(setData).catch((x) => { setError(errText(x)); setData({ summary: {}, daily: [], items: [] }); });
  }, [from, to]);

  return (
    <>
      <PageHead title="Pembukuan" sub="Rekap pemasukan tanpa perlu mencatat sendiri." />

      <section className="card card-white">
        <div className="grid-2">
          <label className="field"><span className="field-label">Dari tanggal</span><input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span className="field-label">Sampai tanggal</span><input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </section>

      <section className="grid-2">
        <div className="card card-black stat"><span>Total pemasukan</span><strong>{rupiah(data?.summary.total)}</strong></div>
        <div className="card card-red stat"><span>Jumlah transaksi</span><strong>{data?.summary.count || 0}</strong></div>
      </section>

      <section className="card card-white">
        <Alert>{error}</Alert>
        {data && data.summary.count > data.items.length && (
          <p className="note">Menampilkan {data.items.length} dari {data.summary.count} transaksi terbaru. Total di atas dihitung dari seluruh transaksi.</p>
        )}
        {!data ? <div className="img-skeleton" /> : data.items.length === 0 ? (
          <Empty title="Tidak ada transaksi" text="Belum ada pembayaran pada rentang tanggal ini." />
        ) : (
          <ul className="list">{data.items.map((t) => <TxRow key={t.id} tx={t} perspective="merchant" />)}</ul>
        )}
      </section>
    </>
  );
}
