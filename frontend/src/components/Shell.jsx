import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon, { Logo } from './Icon.jsx';

const NAV = {
  MAHASISWA: [
    { to: '/app', label: 'Beranda', icon: 'home', end: true },
    { to: '/app/bayar', label: 'Bayar', icon: 'scan' },
    { to: '/app/topup', label: 'Top up', icon: 'plus' },
    { to: '/app/riwayat', label: 'Riwayat', icon: 'clock' },
  ],
  MERCHANT: [
    { to: '/merchant', label: 'Beranda', icon: 'home', end: true },
    { to: '/merchant/pembukuan', label: 'Pembukuan', icon: 'book' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Verifikasi', icon: 'check', end: true },
    { to: '/admin/laporan', label: 'Laporan', icon: 'chart' },
    { to: '/admin/merchant', label: 'Merchant', icon: 'store' },
  ],
};

const ROLE_LABEL = { MAHASISWA: 'Mahasiswa', MERCHANT: 'Merchant', ADMIN: 'Admin' };

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user.role] || [];

  const out = () => {
    logout();
    nav('/masuk', { replace: true });
  };

  return (
    <div className="frame">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={44} />
          <span>Market Day</span>
        </div>
        <nav className="side-nav" aria-label="Menu utama">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className="side-link">
              <Icon name={i.icon} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <div>
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="btn btn-red btn-sm" onClick={out}>Keluar</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="brand brand-sm">
            <Logo size={34} />
            <span>Market Day</span>
          </div>
          <button className="icon-btn" onClick={out} aria-label="Keluar">
            <Icon name="out" size={20} />
          </button>
        </div>
        {children}
      </main>

      <nav className="bottomnav" aria-label="Menu utama">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className="bn-link">
            <Icon name={i.icon} size={22} />
            <span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
