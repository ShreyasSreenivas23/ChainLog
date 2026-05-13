import { useState, useEffect, useCallback } from 'react';
import './index.css';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Simulate from './pages/Simulate.jsx';
import LogExplorer from './pages/LogExplorer.jsx';
import MerkleVerify from './pages/MerkleVerify.jsx';
import Consumers from './pages/Consumers.jsx';

const PAGES = [
  { id: 'dashboard',  label: 'Dashboard',       icon: '⬡', section: 'Overview' },
  { id: 'simulate',   label: 'Simulate API',     icon: '⚡', section: 'Tools' },
  { id: 'logs',       label: 'Log Explorer',     icon: '🔍', section: 'Tools' },
  { id: 'merkle',     label: 'Merkle Verifier',  icon: '🌲', section: 'Tools' },
  { id: 'consumers',  label: 'API Consumers',    icon: '👤', section: 'Admin' },
];

function Toast({ toasts, remove }) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
          <span>{icons[t.type] || 'ℹ️'}</span>
          <span style={{ flex: 1 }}>{t.msg}</span>
          <span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>✕</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

  const refreshStats = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([api.health(), api.stats()]);
      setHealth(h);
      setStats(s);
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    refreshStats();
    const iv = setInterval(refreshStats, 5000);
    return () => clearInterval(iv);
  }, [refreshStats]);

  const sections = [...new Set(PAGES.map(p => p.section))];
  const isOnline = !!health;
  const logCount = stats?.totalLogs ?? health?.totalCachedLogs ?? 0;

  const renderPage = () => {
    const props = { toast, stats, refreshStats };
    switch (page) {
      case 'dashboard':  return <Dashboard {...props} health={health} />;
      case 'simulate':   return <Simulate  {...props} />;
      case 'logs':       return <LogExplorer {...props} />;
      case 'merkle':     return <MerkleVerify {...props} />;
      case 'consumers':  return <Consumers {...props} />;
      default:           return <Dashboard {...props} health={health} />;
    }
  };

  const pageTitle = PAGES.find(p => p.id === page)?.label ?? 'Dashboard';

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⛓</div>
          <div>
            <div className="sidebar-logo-text">ChainLog</div>
            <div className="sidebar-logo-sub">Immutable API Logger</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(sec => (
            <div key={sec}>
              <div className="sidebar-section-label">{sec}</div>
              {PAGES.filter(p => p.section === sec).map(p => (
                <button
                  key={p.id}
                  id={`nav-${p.id}`}
                  className={`nav-item ${page === p.id ? 'active' : ''}`}
                  onClick={() => setPage(p.id)}
                >
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  {p.label}
                  {p.id === 'logs' && logCount > 0 && (
                    <span className="nav-badge">{logCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item" style={{ cursor: 'default' }}>
            <span className={`status-dot ${isOnline ? '' : 'offline'}`} />
            <span style={{ fontSize: 12, color: isOnline ? 'var(--neon-green)' : 'var(--text-muted)' }}>
              {isOnline ? 'Backend Online' : 'Backend Offline'}
            </span>
          </div>
          {isOnline && stats?.contractsLoaded && (
            <div className="nav-item" style={{ cursor: 'default', marginTop: 2 }}>
              <span style={{ fontSize: 13 }}>🔷</span>
              <span style={{ fontSize: 12, color: 'var(--accent-bright)' }}>Contracts Loaded</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">{pageTitle}</div>
          <div className="topbar-right">
            {isOnline ? (
              <div className="topbar-status">
                <span className="live-indicator">
                  <span className="status-dot" />
                  LIVE
                </span>
                <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>·</span>
                <span>{logCount} logs</span>
              </div>
            ) : (
              <div className="topbar-status" style={{ color: 'var(--neon-red)' }}>
                ⚠ Backend unreachable
              </div>
            )}
          </div>
        </header>

        {!isOnline && (
          <div className="alert alert-error connection-banner">
            <span className="alert-icon">⚠️</span>
            <span>
              Backend server is offline. Start it with&nbsp;
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>node backend/server.js</code>
              &nbsp;from the project root.
            </span>
          </div>
        )}

        {renderPage()}
      </div>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}
