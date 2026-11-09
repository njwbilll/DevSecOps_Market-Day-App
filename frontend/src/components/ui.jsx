import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { dateTime, rupiah } from '../format.js';
import Icon from './Icon.jsx';

const STATUS = {
  PENDING: ['Menunggu', 'badge-wait'],
  SUCCESS: ['Berhasil', 'badge-ok'],
  REJECTED: ['Ditolak', 'badge-no'],
};

export function Badge({ status }) {
  const [label, cls] = STATUS[status] || [status, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Empty({ title, text }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

// Gambar yang dilindungi token (bukti transfer)
export function AuthImage({ path, alt, className, onClick }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let url;
    api
      .blobUrl(path)
      .then((u) => {
        url = u;
        if (alive) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (failed) return <div className="img-fallback">Bukti tidak dapat dimuat</div>;
  if (!src) return <div className="img-skeleton" />;
  return <img src={src} alt={alt} className={className} onClick={onClick} />;
}

// Baris transaksi. perspective: 'student' atau 'merchant'
export function TxRow({ tx, perspective = 'student' }) {
  const isTopup = tx.type === 'TOPUP';
  const incoming = perspective === 'merchant' ? true : isTopup;
  const title =
    perspective === 'merchant'
      ? tx.student?.name || 'Pembayaran'
      : isTopup
        ? 'Top up saldo'
        : `Bayar ke ${tx.merchant?.name || 'merchant'}`;

  return (
    <li className="row">
      <span className={`row-icon ${incoming ? 'in' : 'out'}`}>
        <Icon name={incoming ? 'down' : 'up'} size={20} />
      </span>
      <span className="row-main">
        <span className="row-title">{title}</span>
        <span className="row-sub">
          {dateTime(tx.createdAt)} &middot; {tx.receiptNo}
        </span>
      </span>
      <span className={`amount ${incoming ? 'plus' : 'minus'}`}>
        {incoming ? '+' : '-'}
        {rupiah(tx.amount)}
      </span>
    </li>
  );
}
