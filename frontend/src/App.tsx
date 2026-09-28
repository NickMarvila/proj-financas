import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Wallet, Settings, History
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Ponto from './pages/Ponto';
import Financas from './pages/Financas';
import Configuracoes from './pages/Configuracoes';
import Historico from './pages/Historico';
import Login from './pages/Login';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/ponto', icon: Clock, label: 'Ponto' },
  { to: '/financas', icon: Wallet, label: 'Finanças' },
  { to: '/historico', icon: History, label: 'Histórico' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function MainLayout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">💰</div>
          <div>
            <div className="logo-text">FinançasPonto</div>
            <div className="logo-sub">Nicolas Marvila</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            style={{background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding:0}}
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ponto" element={<Ponto />} />
          <Route path="/financas" element={<Financas />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
