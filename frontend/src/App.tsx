import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Wallet, Settings, History, Menu, LogOut, User, ExternalLink
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

// Destinos fixos na barra inferior do celular; o restante fica no drawer (botão "Menu")
const primaryNavItems = navItems.slice(0, 4);
const drawerOnlyPaths = navItems.slice(4).map(i => i.to);

function MobileBottomNav({ menuOpen, onToggleMenu }: { menuOpen: boolean; onToggleMenu: () => void }) {
  const { pathname } = useLocation();
  const menuActive = menuOpen || drawerOnlyPaths.some(p => pathname.startsWith(p));

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {primaryNavItems.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className={`mob-nav-item${menuActive ? ' active' : ''}`}
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-controls="app-drawer"
      >
        <Menu size={22} />
        <span>Menu</span>
      </button>
    </nav>
  );
}

function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    authApi.me().then(u => {
      setUserName(u.employeeName || u.username);
      setIsAdmin(u.role === 'ADMIN');
    }).catch(() => {});
  }, []);

  // Drawer aberto: fecha com Esc e trava a rolagem do fundo
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="app-layout">
      {/* Mobile Top Bar */}
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <span className="brand-dot">💰</span>
          <span className="brand-name">FinançasPonto</span>
        </div>
        <div className="mobile-topbar-user">
          <span className="user-pill">{userName ? `Olá, ${userName.split(' ')[0]}` : 'Conectado'}</span>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay${mobileMenuOpen ? ' visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside id="app-drawer" className={`sidebar${mobileMenuOpen ? ' mobile-open' : ''}`}>
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
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px' }}>
          {isAdmin && (
            <a
              href="https://console.cloud.google.com/apis/credentials/consent?project=financasponto"
              target="_blank"
              rel="noopener noreferrer"
              title="Adicionar e-mails de teste no Google Cloud Console"
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                padding: '6px 8px',
                minHeight: 44,
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                transition: 'all 0.2s',
              }}
            >
              <ExternalLink size={13} color="#60a5fa" />
              <span>Google Cloud (Test Users)</span>
            </a>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            style={{background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', padding: '6px 8px', minHeight: 44, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14}}
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
      <MobileBottomNav
        menuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen(o => !o)}
      />
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
