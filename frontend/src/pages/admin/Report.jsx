import { useEffect, useState } from 'react';
import { api, errText } from '../../api.js';
import { addDays, dateTime, rupiah, todayWIB } from '../../format.js';
import { Alert, Empty, PageHead } from '../../components/ui.jsx';

const TYPES = [
  ['ALL', 'Semua'],
  ['PAYMENT', 'Pembayaran'],
  ['TOPUP', 'Top up'],
];

export default function AdminReport() {
  const [from, setFrom] = useState(addDays(todayWIB(), -6));
  const [to, setTo] = useState(todayWIB());
  const [type, setType] = useState('ALL');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const qs = () => new URLSearchParams({ from, to, type }).toString();

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/admin/report?${qs()}`).then(setData).catch((x) => { setError(errText(x)); setData({ rows: [], summary: {}, byMerchant: [] }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, type]);

  const s = data?.summary || {};
  const max = Math.max(1, ...(data?.byMerchant || []).map((m) => m.total));

  async function exportCsv() {
    try {
      await api.download(`/admin/report.csv?${qs()}`, `laporan-market-day-${from}_${to}.csv`);
    } catch (x) {
      setError(errText(x));
    }
  }

  return (
    <>
      <PageHead title="Laporan rekap" sub="Rekap transaksi dan top up yang berhasil.">
        <button className="btn btn-black btn-sm" onClick={exportCsv} disabled={!data || data.rows.length === 0}>Unduh CSV</button>
      </PageHead>

      <section className="card card-white stack">
        <div className="chips">
          {TYPES.map(([v, label]) => (
            <button key={v} className={`chip ${type === v ? 'on' : ''}`} onClick={() => setType(v)}>{label}</button>
          ))}
        </div>
        <div className="grid-2">
          <label className="field"><span className="field-label">Dari tanggal</span><input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span className="field-label">Sampai tanggal</span><input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </section>

      <Alert>{error}</Alert>

      <section className="grid-2">
        <div className="card card-black stat"><span>Top up berhasil</span><strong>{rupiah(s.topupTotal)}</strong><small>{s.topupCount || 0} transaksi</small></div>
        <div className="card card-red stat"><span>Pembayaran merchant</span><strong>{rupiah(s.paymentTotal)}</strong><small>{s.paymentCount || 0} transaksi</small></div>
      </section>

      {data?.byMerchant.length > 0 && (
        <section className="card card-white">
          <div className="card-head"><h2>Penjualan per merchant</h2></div>
          <div className="bars">
            {data.byMerchant.map((m, i) => (
              <div key={m.name} className="bar-row bar-row-wide">
                <span className="bar-label">{m.name}</span>
                <span className="bar-track"><i className={`bar-fill ${i === 0 ? 'today' : ''}`} style={{ width: `${(m.total / max) * 100}%` }} /></span>
                <span className="bar-value">{rupiah(m.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card card-white">
        <div className="card-head"><h2>Rincian transaksi</h2></div>
        {!data ? <div className="img-skeleton" /> : data.rows.length === 0 ? (
          <Empty title="Tidak ada data" text="Belum ada transaksi berhasil pada filter ini." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Waktu</th><th>Jenis</th><th>Mahasiswa</th><th>Merchant</th><th className="num">Jumlah</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.receiptNo}>
                    <td>{dateTime(r.createdAt)}</td>
                    <td>{r.type === 'TOPUP' ? 'Top up' : 'Pembayaran'}</td>
                    <td>{r.student?.name}</td>
                    <td>{r.merchant?.name || '-'}</td>
                    <td className="num">{rupiah(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
