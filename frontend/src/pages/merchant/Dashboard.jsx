import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import { addDays, dayLabel, rupiah, todayWIB } from '../../format.js';
import { Empty, PageHead, TxRow } from '../../components/ui.jsx';

export default function MerchantDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    const to = todayWIB();
    const from = addDays(to, -6);
    api.get(`/merchant/ledger?from=${from}&to=${to}`).then(setData).catch(() => setData({ summary: {}, daily: [], items: [] }));
  }, []);

  const to = todayWIB();
  const days = Array.from({ length: 7 }, (_, i) => addDays(to, i - 6)).map((d) => {
    const hit = data?.daily.find((x) => x.date === d);
    return { date: d, total: hit?.total || 0, count: hit?.count || 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  const s = data?.summary || {};

  return (
    <>
      <PageHead title={user.name} sub="Penjualan tercatat otomatis dari setiap pembayaran masuk." />

      <section className="grid-2">
        <div className="card card-black stat">
          <span>Pemasukan hari ini</span>
          <strong>{rupiah(s.todayTotal)}</strong>
        </div>
        <div className="card card-red stat">
          <span>Transaksi hari ini</span>
          <strong>{s.todayCount || 0}</strong>
        </div>
      </section>

      <section className="card card-white">
        <div className="card-head"><h2>7 hari terakhir</h2><span className="sub">{rupiah(s.total)}</span></div>
        <div className="bars">
          {days.map((d) => (
            <div key={d.date} className="bar-row">
              <span className="bar-label">{dayLabel(d.date)}</span>
              <span className="bar-track"><i className={`bar-fill ${d.date === to ? 'today' : ''}`} style={{ width: `${(d.total / max) * 100}%` }} /></span>
              <span className="bar-value">{rupiah(d.total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-white qr-print">
        <div className="card-head"><h2>QR pembayaran</h2><button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>Cetak</button></div>
        <div className="qr-box">
          <QRCodeSVG value={`MARKETDAY:${user.merchantCode}`} size={200} level="M" marginSize={2} fgColor="#000000" bgColor="#ffffff" />
          <strong>{user.name}</strong>
          <small>Kode {user.merchantCode}</small>
        </div>
      </section>

      <section className="card card-white">
        <div className="card-head"><h2>Pembayaran terbaru</h2><Link to="/merchant/pembukuan" className="link">Pembukuan</Link></div>
        {!data ? <div className="img-skeleton" /> : data.items.length === 0 ? (
          <Empty title="Belum ada pembayaran" text="Tunjukkan QR di atas kepada pembeli." />
        ) : (
          <ul className="list">{data.items.slice(0, 5).map((t) => <TxRow key={t.id} tx={t} perspective="merchant" />)}</ul>
        )}
      </section>
    </>
  );
}
