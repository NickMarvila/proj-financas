import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Wallet, Settings, History, TrendingUp
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Ponto from './pages/Ponto';
import Financas from './pages/Financas';
import Configuracoes from './pages/Configuracoes';
import Historico from './pages/Historico';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/ponto', icon: Clock, label: 'Ponto' },
  { to: '/financas', icon: Wallet, label: 'Finanças' },
  { to: '/historico', icon: History, label: 'Histórico' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

export default function App() {
  return (
    <BrowserRouter>
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
            v1.0.0 · 2026
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
    </BrowserRouter>
  );
}
