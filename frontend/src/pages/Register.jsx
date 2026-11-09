import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errText } from '../api.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      nav('/masuk', { replace: true });
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Buat akun"
      sub="Akun baru otomatis terdaftar sebagai mahasiswa."
      footer={<>Sudah punya akun? <Link to="/masuk">Masuk</Link></>}
    >
      <form onSubmit={submit} className="stack">
        <Alert>{error}</Alert>
        <Field label="Nama lengkap">
          <input className="input" value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} maxLength={60} />
        </Field>
        <Field label="Username" hint="4-20 karakter: huruf kecil, angka, atau underscore">
          <input className="input" value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Password" hint="Minimal 8 karakter">
          <input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required minLength={8} maxLength={72} />
        </Field>
        <button className="btn btn-black btn-block" disabled={busy}>{busy ? 'Memproses...' : 'Daftar'}</button>
      </form>
    </AuthLayout>
  );
}
