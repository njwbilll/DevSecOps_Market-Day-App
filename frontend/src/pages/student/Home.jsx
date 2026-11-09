import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import { rupiah } from '../../format.js';
import Icon from '../../components/Icon.jsx';
import { Empty, TxRow } from '../../components/ui.jsx';

export default function StudentHome() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    refresh().catch(() => {});
    api.get('/transactions?limit=5').then((d) => setItems(d.items)).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="sub">Halo,</p>
          <h1>{user.name}</h1>
        </div>
      </header>

      <section className="card card-black balance">
        <span className="balance-label">Saldo kamu</span>
        <strong className="balance-value">{rupiah(user.balance)}</strong>
        <i className="balance-deco" aria-hidden="true" />
      </section>

      <section className="grid-2">
        <Link to="/app/bayar" className="tile tile-red">
          <Icon name="scan" size={30} />
          <strong>Bayar</strong>
          <span>Scan QR merchant</span>
        </Link>
        <Link to="/app/topup" className="tile tile-white">
          <Icon name="plus" size={30} />
          <strong>Top up</strong>
          <span>Isi saldo</span>
        </Link>
      </section>

      <section className="card card-white">
        <div className="card-head">
          <h2>Transaksi terakhir</h2>
          <Link to="/app/riwayat" className="link">Lihat semua</Link>
        </div>
        {items === null ? (
          <div className="img-skeleton" />
        ) : items.length === 0 ? (
          <Empty title="Belum ada transaksi" text="Top up saldo dulu, lalu scan QR merchant untuk membayar." />
        ) : (
          <ul className="list">{items.map((t) => <TxRow key={t.id} tx={t} />)}</ul>
        )}
      </section>
    </>
  );
}
