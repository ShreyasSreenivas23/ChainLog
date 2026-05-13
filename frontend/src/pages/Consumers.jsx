import { useState, useEffect, useCallback } from 'react';
import { api, shortAddr, formatTime } from '../api.js';

export default function Consumers({ toast }) {
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ address: '', name: '', organization: '' });
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.consumers();
      setConsumers(r.consumers || []);
    } catch (e) {
      // backend may not have contracts loaded
      setConsumers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const register = async () => {
    if (!form.address || !form.name || !form.organization) {
      toast?.('⚠ Fill in all fields', 'error'); return;
    }
    setSubmitting(true);
    try {
      await api.registerConsumer(form);
      toast?.(`✅ Registered ${form.name}`, 'success');
      setForm({ address: '', name: '', organization: '' });
      load();
    } catch (e) {
      toast?.(`❌ ${e.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (address, name) => {
    if (!window.confirm(`Revoke API key for ${name}?`)) return;
    try {
      await api.revokeConsumer({ address });
      toast?.(`🚫 Revoked ${name}`, 'info');
      load();
    } catch (e) {
      toast?.(`❌ ${e.message}`, 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">API Consumers</div>
          <div className="page-subtitle">Manage registered API consumers. Only registered addresses can log calls to the blockchain.</div>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      <div className="grid-2">
        {/* Registration Form */}
        <div className="card">
          <div className="card-title">➕ Register New Consumer (Admin)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Wallet Address</label>
              <input id="input-wallet" className="form-input" placeholder="0x..."
                value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Consumer Name</label>
              <input id="input-name" className="form-input" placeholder="e.g. PaymentService"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Organization</label>
              <input id="input-org" className="form-input" placeholder="e.g. FinTech Corp"
                value={form.organization} onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
            </div>
            <button id="btn-register" className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`}
              onClick={register} disabled={submitting}>
              {!submitting && '✅ Register Consumer'}
            </button>
          </div>

          <div style={{ marginTop: 20, padding: '14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>HOW ACCESS CONTROL WORKS</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              The <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>APIKeyRegistry</code> smart contract
              maintains a whitelist of registered addresses. The <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>onlyRegistered</code>{' '}
              modifier in <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>APILogger</code> rejects
              any log attempt from an unregistered or revoked address, enforcing the CIA triad's <strong>Access Control</strong>.
            </div>
          </div>
        </div>

        {/* Consumers List */}
        <div className="card">
          <div className="card-title">👥 Registered Consumers ({consumers.length})</div>
          {loading ? (
            <div className="loading-state"><div className="spinner" /> Loading…</div>
          ) : consumers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title">No consumers found</div>
              <div className="empty-state-sub">Contracts may not be deployed yet. Run the deploy script first.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consumers.map((c, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                  background: selected === i ? 'var(--bg-hover)' : 'var(--bg-surface)',
                  border: `1px solid ${selected === i ? 'var(--border-glow)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer', transition: 'all 0.15s'
                }} onClick={() => setSelected(selected === i ? null : i)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: c.isActive ? 'rgba(34,211,160,0.1)' : 'rgba(100,100,100,0.1)',
                        border: `1px solid ${c.isActive ? 'rgba(34,211,160,0.3)' : 'rgba(100,100,100,0.3)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0
                      }}>
                        {c.isActive ? '✓' : '✕'}
                      </span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.organization}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge badge-${c.isActive ? 'success' : 'neutral'}`}>
                        {c.isActive ? 'Active' : 'Revoked'}
                      </span>
                      {c.isActive && (
                        <button className="btn btn-danger btn-sm"
                          onClick={e => { e.stopPropagation(); revoke(c.address, c.name); }}>
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>

                  {selected === i && (
                    <div className="info-panel" style={{ marginTop: 12 }}>
                      <div className="info-row">
                        <span className="info-key">Address</span>
                        <span className="info-val mono">{c.address}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-key">Call Count</span>
                        <span className="info-val">{c.callCount}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-key">Registered At</span>
                        <span className="info-val">{formatTime(c.registeredAt)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
