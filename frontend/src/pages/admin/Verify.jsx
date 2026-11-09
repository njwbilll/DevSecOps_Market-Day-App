import { useEffect, useState } from 'react';
import { api, errText } from '../../api.js';
import { dateTime, rupiah } from '../../format.js';
import { Alert, AuthImage, Badge, Empty, PageHead } from '../../components/ui.jsx';

const TABS = [
  ['PENDING', 'Menunggu'],
  ['SUCCESS', 'Disetujui'],
  ['REJECTED', 'Ditolak'],
];

export default function AdminVerify() {
  const [status, setStatus] = useState('PENDING');
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState({});
  const [zoom, setZoom] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setItems(null);
    api.get(`/admin/topups?status=${status}`).then((d) => setItems(d.items)).catch((x) => { setError(errText(x)); setItems([]); });
  };
  useEffect(load, [status]);

  async function decide(t, approve) {
    const msg = approve
      ? `Setujui top up ${rupiah(t.amount)} untuk ${t.student.name}? Saldo akan langsung bertambah.`
      : `Tolak pengajuan top up ${rupiah(t.amount)} dari ${t.student.name}?`;
    if (!window.confirm(msg)) return;
    setBusyId(t.id);
    setError('');
    try {
      await api.post(`/admin/topups/${t.id}/verify`, { approve, note: notes[t.id]?.trim() || undefined });
      load();
    } catch (x) {
      setError(errText(x));
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHead title="Verifikasi top up" sub="Periksa bukti transfer sebelum saldo mahasiswa ditambahkan." />

      <div className="tabs">
        {TABS.map(([v, label]) => (
          <button key={v} className={`tab ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{label}</button>
        ))}
      </div>

      <Alert>{error}</Alert>

      {items === null ? (
        <div className="card card-white"><div className="img-skeleton" /></div>
      ) : items.length === 0 ? (
        <div className="card card-white"><Empty title="Tidak ada pengajuan" text="Pengajuan dengan status ini belum ada." /></div>
      ) : (
        <div className="stack">
          {items.map((t) => (
            <article key={t.id} className="card card-white topup">
              <AuthImage path={`/topups/${t.id}/proof`} alt={`Bukti transfer ${t.student.name}`} className="proof-thumb" onClick={() => setZoom(t.id)} />
              <div className="topup-body">
                <div className="topup-top">
                  <strong className="topup-amount">{rupiah(t.amount)}</strong>
                  <Badge status={t.status} />
                </div>
                <span className="row-title">{t.student.name}</span>
                <span className="row-sub">
                  @{t.student.username} &middot; {t.method === 'BANK' ? 'Transfer bank' : 'E-wallet'} &middot; {dateTime(t.createdAt)}
                </span>
                {t.status !== 'PENDING' && (
                  <span className="row-sub">Diverifikasi oleh {t.verifier?.name || '-'}{t.adminNote ? ` · ${t.adminNote}` : ''}</span>
                )}
                {t.status === 'PENDING' && (
                  <>
                    <input className="input" placeholder="Catatan (opsional)" maxLength={150} value={notes[t.id] || ''} onChange={(e) => setNotes({ ...notes, [t.id]: e.target.value })} />
                    <div className="grid-2">
                      <button className="btn btn-black" disabled={busyId === t.id} onClick={() => decide(t, true)}>Setujui</button>
                      <button className="btn btn-ghost" disabled={busyId === t.id} onClick={() => decide(t, false)}>Tolak</button>
                    </div>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-label="Bukti transfer">
          <AuthImage path={`/topups/${zoom}/proof`} alt="Bukti transfer" className="lightbox-img" />
          <button className="btn btn-white btn-sm">Tutup</button>
        </div>
      )}
    </>
  );
}
