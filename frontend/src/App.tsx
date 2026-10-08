import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Wallet, Settings, History, Menu, X, LogOut, User
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Ponto from './pages/Ponto';
import Financas from './pages/Financas';
import Configuracoes from './pages/Configuracoes';
import Historico from './pages/Historico';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import { authApi } from './api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/ponto', icon: Clock, label: 'Ponto' },
  { to: '/financas', icon: Wallet, label: 'Finanças' },
  { to: '/historico', icon: History, label: 'Histórico' },
  { to: '/perfil', icon: User, label: 'Perfil' },
  { to: '/configuracoes', icon: Settings, label: 'Config' },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav">
      {navItems.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button
        className="mob-nav-item"
        onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}
        style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}
      >
        <LogOut size={20} />
        <span>Sair</span>
      </button>
    </nav>
  );
}

function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    authApi.me().then(u => {
      setUserName(u.employeeName || u.username);
    }).catch(() => {});
  }, []);

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div
        className={`mobile-overlay${mobileMenuOpen ? ' visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`sidebar${mobileMenuOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">💰</div>
          <div>
            <div className="logo-text">FinançasPonto</div>
            <div className="logo-sub">{userName || 'Carregando...'}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon size={18} />
              {label === 'Config' ? 'Configurações' : label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            style={{background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13}}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ponto" element={<Ponto />} />
          <Route path="/financas" element={<Financas />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </main>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
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
