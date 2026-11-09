import { useEffect, useState } from 'react';
import { api, errText } from '../../api.js';
import { Alert, Empty, Field, PageHead } from '../../components/ui.jsx';

const EMPTY = { name: '', username: '', password: '', merchantCode: '' };

export default function AdminMerchants() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/admin/merchants').then((d) => setList(d.items)).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const m = await api.post('/admin/merchants', form);
      setOk(`Merchant ${m.name} ditambahkan`);
      setForm(EMPTY);
      load();
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Merchant" sub="Tambah akun merchant untuk kegiatan Market Day." />

      <form className="card card-white stack" onSubmit={submit}>
        <Alert>{error}</Alert>
        <Alert kind="ok">{ok}</Alert>
        <Field label="Nama merchant"><input className="input" value={form.name} onChange={set('name')} required minLength={2} maxLength={60} /></Field>
        <div className="grid-2">
          <Field label="Username" hint="4-20 karakter"><input className="input" value={form.username} onChange={set('username')} autoCapitalize="none" required /></Field>
          <Field label="Kode merchant" hint="3-12 huruf atau angka"><input className="input" value={form.merchantCode} onChange={(e) => setForm({ ...form, merchantCode: e.target.value.toUpperCase() })} required maxLength={12} /></Field>
        </div>
        <Field label="Password awal" hint="Minimal 8 karakter"><input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required minLength={8} maxLength={72} /></Field>
        <button className="btn btn-black btn-block" disabled={busy}>{busy ? 'Menyimpan...' : 'Tambah merchant'}</button>
      </form>

      <section className="card card-white">
        <div className="card-head"><h2>Daftar merchant</h2></div>
        {list === null ? <div className="img-skeleton" /> : list.length === 0 ? (
          <Empty title="Belum ada merchant" text="Tambahkan merchant pertama lewat form di atas." />
        ) : (
          <ul className="list">
            {list.map((m) => (
              <li key={m.id} className="row">
                <span className="avatar">{m.name.slice(0, 1)}</span>
                <span className="row-main">
                  <span className="row-title">{m.name}</span>
                  <span className="row-sub">@{m.username}</span>
                </span>
                <span className="badge badge-wait">{m.merchantCode}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
