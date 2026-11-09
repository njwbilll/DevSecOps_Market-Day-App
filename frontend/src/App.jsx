import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { homeFor } from './format.js';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import StudentHome from './pages/student/Home.jsx';
import TopUp from './pages/student/TopUp.jsx';
import Pay from './pages/student/Pay.jsx';
import History from './pages/student/History.jsx';
import MerchantDashboard from './pages/merchant/Dashboard.jsx';
import MerchantLedger from './pages/merchant/Ledger.jsx';
import AdminVerify from './pages/admin/Verify.jsx';
import AdminReport from './pages/admin/Report.jsx';
import AdminMerchants from './pages/admin/Merchants.jsx';

function Splash() {
  return <div className="splash">Memuat...</div>;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function Private({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/masuk" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Shell>{children}</Shell>;
}

const S = ['MAHASISWA'];
const M = ['MERCHANT'];
const A = ['ADMIN'];

export default function App() {
  return (
    <Routes>
      <Route path="/masuk" element={<Guest><Login /></Guest>} />
      <Route path="/daftar" element={<Guest><Register /></Guest>} />

      <Route path="/app" element={<Private roles={S}><StudentHome /></Private>} />
      <Route path="/app/topup" element={<Private roles={S}><TopUp /></Private>} />
      <Route path="/app/bayar" element={<Private roles={S}><Pay /></Private>} />
      <Route path="/app/riwayat" element={<Private roles={S}><History /></Private>} />

      <Route path="/merchant" element={<Private roles={M}><MerchantDashboard /></Private>} />
      <Route path="/merchant/pembukuan" element={<Private roles={M}><MerchantLedger /></Private>} />

      <Route path="/admin" element={<Private roles={A}><AdminVerify /></Private>} />
      <Route path="/admin/laporan" element={<Private roles={A}><AdminReport /></Private>} />
      <Route path="/admin/merchant" element={<Private roles={A}><AdminMerchants /></Private>} />

      <Route path="*" element={<Navigate to="/masuk" replace />} />
    </Routes>
  );
}
