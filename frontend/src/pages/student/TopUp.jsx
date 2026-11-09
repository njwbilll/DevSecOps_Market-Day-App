import { useEffect, useState } from 'react';
import { useAuth } from '../../auth.jsx';
import { api, errText } from '../../api.js';
import { dateTime, rupiah } from '../../format.js';
import { Alert, Badge, Empty, Field, PageHead } from '../../components/ui.jsx';

const QUICK = [20000, 50000, 100000, 200000];
const METHOD = { BANK: 'Transfer bank (virtual account)', EWALLET: 'E-wallet' };

export default function TopUp() {
  const { refresh } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK');
  const [list, setList] = useState(null);
  const [sandbox, setSandbox] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  const load = () =>
    api
      .get('/topups')
      .then((d) => {
        setList(d.items);
        setSandbox(d.sandbox);
        return d.items;
      })
      .catch(() => setList([]));

  useEffect(() => { load(); }, []);

  // Selama ada tagihan yang belum dibayar, cek status berkala. Saldo diperbarui otomatis.
  const hasPending = list?.some((t) => t.status === 'PENDING');
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      load().then((items) => {
        if (items && !items.some((t) => t.status === 'PENDING')) refresh().catch(() => {});
      });
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 10000) return setError('Minimal top up Rp10.000');
    setBusy(true);
    try {
      await api.post('/topups', { amount: value, method });
      setAmount('');
      await load();
    } catch (x) {
      setError(errText(x));
    } finally {
      setBusy(false);
    }
  }

  async function simulate(t) {
    setError('');
    try {
      await api.post(`/topups/${t.id}/simulate-pay`);
      await load();
      refresh().catch(() => {});
    } catch (x) {
      setError(errText(x));
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  }

  return (
    <>
      <PageHead title="Top up saldo" sub="Buat tagihan, bayar lewat bank atau e-wallet. Saldo bertambah otomatis setelah pembayaran terkonfirmasi." />

      <form className="card card-white stack" onSubmit={submit}>
        <Alert>{error}</Alert>

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

        <Field label="Metode pembayaran">
          <div className="chips">
            <button type="button" className={`chip ${method === 'BANK' ? 'on' : ''}`} onClick={() => setMethod('BANK')}>Transfer bank</button>
            <button type="button" className={`chip ${method === 'EWALLET' ? 'on' : ''}`} onClick={() => setMethod('EWALLET')}>E-wallet</button>
          </div>
        </Field>

        <button className="btn btn-black btn-block" disabled={busy}>{busy ? 'Membuat tagihan...' : 'Buat tagihan'}</button>
      </form>

      <section className="card card-white">
        <div className="card-head"><h2>Tagihan dan riwayat top up</h2></div>
        {list === null ? (
          <div className="img-skeleton" />
        ) : list.length === 0 ? (
          <Empty title="Belum ada top up" text="Tagihan top up kamu akan muncul di sini." />
        ) : (
          <ul className="list">
            {list.map((t) => (
              <li key={t.id} className={`bill ${t.status === 'PENDING' ? 'bill-open' : ''}`}>
                <div className="bill-top">
                  <span className="row-main">
                    <span className="row-title">{rupiah(t.amount)}</span>
                    <span className="row-sub">{dateTime(t.createdAt)} &middot; {METHOD[t.method]}</span>
                  </span>
                  <Badge status={t.status === 'PENDING' ? 'PENDING' : t.status} />
                </div>

                {t.status === 'PENDING' && (
                  <div className="bill-pay">
                    <span className="row-sub">{t.method === 'BANK' ? 'Nomor virtual account' : 'Kode pembayaran e-wallet'}</span>
                    <div className="bill-code">
                      <strong>{t.paymentCode || t.reference}</strong>
                      <button type="button" className="btn btn-white btn-sm" onClick={() => copy(t.paymentCode || t.reference)}>
                        {copied === (t.paymentCode || t.reference) ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                    <span className="row-sub">Bayar tepat {rupiah(t.amount)}. Status berubah otomatis setelah pembayaran diterima.</span>
                    {sandbox && (
                      <button type="button" className="btn btn-red btn-sm" onClick={() => simulate(t)}>
                        Simulasikan pembayaran berhasil (sandbox)
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
