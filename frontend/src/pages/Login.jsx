import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errText } from '../api.js';
import { homeFor } from '../format.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.username.trim(), form.password);
      nav(homeFor(u.role), { replace: true });
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Masuk"
      sub="Bayar dengan scan QR, tanpa antre dan tanpa form manual."
      footer={<>Belum punya akun? <Link to="/daftar">Daftar sebagai mahasiswa</Link></>}
    >
      <form onSubmit={submit} className="stack">
        <Alert>{error}</Alert>
        <Field label="Username">
          <input className="input" value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="current-password" required />
        </Field>
        <button className="btn btn-black btn-block" disabled={busy}>{busy ? 'Memproses...' : 'Masuk'}</button>
      </form>
    </AuthLayout>
  );
}
