import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth.jsx';
import { api, errText } from '../../api.js';
import { dateTime, rupiah } from '../../format.js';
import { Alert, Badge, Empty, Field, PageHead } from '../../components/ui.jsx';

const QUICK = [20000, 50000, 100000, 200000];

export default function TopUp() {
  const { refresh } = useAuth();
  const fileRef = useRef(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/topups').then((d) => setList(d.items)).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e) {
    const f = e.target.files?.[0];
    setError('');
    if (!f) return setFile(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('File harus berupa gambar JPG, PNG, atau WEBP');
      return setFile(null);
    }
    if (f.size > 2 * 1024 * 1024) {
      setError('Ukuran file maksimal 2 MB');
      return setFile(null);
    }
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 10000) return setError('Minimal top up Rp10.000');
    if (!file) return setError('Unggah bukti transfer terlebih dahulu');

    const form = new FormData();
    form.append('amount', String(value));
    form.append('method', method);
    form.append('proof', file);

    setBusy(true);
    try {
      await api.upload('/topups', form);
      setOk('Pengajuan terkirim. Saldo bertambah setelah admin memverifikasi.');
      setAmount('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
      refresh().catch(() => {});
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Top up saldo" sub="Transfer ke rekening panitia, lalu unggah bukti transfernya." />

      <form className="card card-white stack" onSubmit={submit}>
        <Alert>{error}</Alert>
        <Alert kind="ok">{ok}</Alert>

        <Field label="Nominal" hint={amount ? rupiah(amount) : 'Minimal Rp10.000, maksimal Rp1.000.000'}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="50000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))}
          />
        </Field>
        <div className="chips">
          {QUICK.map((q) => (
            <button type="button" key={q} className={`chip ${Number(amount) === q ? 'on' : ''}`} onClick={() => setAmount(String(q))}>
              {rupiah(q)}
            </button>
          ))}
        </div>

        <Field label="Metode">
          <div className="chips">
            <button type="button" className={`chip ${method === 'BANK' ? 'on' : ''}`} onClick={() => setMethod('BANK')}>Transfer bank</button>
            <button type="button" className={`chip ${method === 'EWALLET' ? 'on' : ''}`} onClick={() => setMethod('EWALLET')}>E-wallet</button>
          </div>
        </Field>

        <Field label="Bukti transfer" hint="JPG, PNG, atau WEBP, maksimal 2 MB">
          <input ref={fileRef} className="input input-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} />
        </Field>
        {preview && <img className="proof-preview" src={preview} alt="Pratinjau bukti transfer" />}

        <button className="btn btn-black btn-block" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim pengajuan'}</button>
      </form>

      <section className="card card-white">
        <div className="card-head"><h2>Pengajuan saya</h2></div>
        {list === null ? (
          <div className="img-skeleton" />
        ) : list.length === 0 ? (
          <Empty title="Belum ada pengajuan" text="Pengajuan top up kamu akan muncul di sini." />
        ) : (
          <ul className="list">
            {list.map((t) => (
              <li key={t.id} className="row">
                <span className="row-main">
                  <span className="row-title">{rupiah(t.amount)}</span>
                  <span className="row-sub">
                    {dateTime(t.createdAt)} &middot; {t.method === 'BANK' ? 'Transfer bank' : 'E-wallet'}
                    {t.adminNote ? ` · ${t.adminNote}` : ''}
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
