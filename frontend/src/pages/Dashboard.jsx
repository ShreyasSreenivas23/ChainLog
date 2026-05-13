import { useState, useEffect, useCallback } from 'react';
import { api, shortHash, shortAddr, statusVariant, formatTime } from '../api.js';

function StatCard({ label, value, sub, icon, subClass }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className={`stat-sub ${subClass || ''}`}>{sub}</div>}
    </div>
  );
}

export default function Dashboard({ health, stats, refreshStats }) {
  const [recentLogs, setRecentLogs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [ls, bs] = await Promise.all([
        api.logs({ limit: 8 }),
        api.batches(),
      ]);
      setRecentLogs(ls.logs || []);
      setBatches(bs.batches || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const successRate = recentLogs.length > 0
    ? Math.round(recentLogs.filter(l => l.statusCode >= 200 && l.statusCode < 300).length / recentLogs.length * 100)
    : 0;

  return (
    <div className="page">
      {/* ── Stats Row ── */}
      <div className="stats-grid">
        <StatCard label="Total Logs" icon="📋" value={stats?.totalLogs ?? health?.totalCachedLogs ?? 0}
          sub="immutably recorded" />
        <StatCard label="Merkle Batches" icon="🌲" value={stats?.totalBatches ?? batches.length}
          sub={`${stats?.pendingBatchSize ?? 0} pending`} />
        <StatCard label="Success Rate" icon="✅" value={`${successRate}%`}
          sub="of recent calls" subClass={successRate >= 70 ? 'up' : 'down'} />
        <StatCard label="Contracts" icon="🔷"
          value={stats?.contractsLoaded ? 'Live' : 'Offline'}
          sub={stats?.contractsLoaded ? 'On Hardhat' : 'Deploy first'} />
      </div>

      {/* ── Two-col layout ── */}
      <div className="grid-2">
        {/* Recent Activity */}
        <div className="card">
          <div className="card-title"><span className="card-title-icon">⚡</span>Recent API Calls</div>
          {loading ? (
            <div className="loading-state"><div className="spinner" /> Loading logs…</div>
          ) : recentLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No logs yet</div>
              <div className="empty-state-sub">Use the Simulate API page to record your first blockchain log.</div>
            </div>
          ) : (
            <div>
              {recentLogs.map((log, i) => (
                <div className="activity-item" key={i}>
                  <div className={`activity-icon ${statusVariant(log.statusCode)}`}>
                    {log.statusCode >= 200 && log.statusCode < 300 ? '✓' :
                     log.statusCode >= 500 ? '✕' : '!'}
                  </div>
                  <div className="activity-body">
                    <div className="activity-title">
                      <span className={`badge badge-${log.method === 'POST' ? 'info' : 'purple'}`}>{log.method}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {log.endpoint}
                      </span>
                    </div>
                    <div className="activity-meta">
                      <span>{shortAddr(log.caller)}</span>
                      <span className={`badge badge-${statusVariant(log.statusCode)}`}>{log.statusCode}</span>
                      <span>{log.responseTimeMs}ms</span>
                    </div>
                  </div>
                  <div className="activity-time">{formatTime(log.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Merkle Batches */}
        <div className="card">
          <div className="card-title"><span className="card-title-icon">🌲</span>Merkle Batches</div>
          {batches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🌿</div>
              <div className="empty-state-title">No batches finalized</div>
              <div className="empty-state-sub">Batches auto-finalize every 10 logs, or manually via the button below.</div>
            </div>
          ) : (
            <div>
              {batches.slice(-5).reverse().map((b, i) => (
                <div className="activity-item" key={i}>
                  <div className="activity-icon info">🌲</div>
                  <div className="activity-body">
                    <div className="activity-title">
                      <span className="badge badge-info">Batch #{b.batchId}</span>
                      <span style={{ fontSize: 12 }}>{b.logCount} logs</span>
                    </div>
                    <div className="activity-meta">
                      <span>Root:</span>
                      <span className="hash-display">{shortHash(b.merkleRoot)}</span>
                    </div>
                  </div>
                  <div className="activity-time">{formatTime(b.finalizedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Deployment Info ── */}
      <DeploymentInfo />
    </div>
  );
}

function DeploymentInfo() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    api.deployment().then(setInfo).catch(() => {});
  }, []);
  if (!info || info.error) return null;
  return (
    <div className="card chain-card">
      <div className="card-title"><span className="card-title-icon">🔗</span>Deployment Info</div>
      <div className="info-panel">
        <div className="info-row">
          <span className="info-key">Network</span>
          <span className="info-val">{info.network} (Chain ID: {info.chainId})</span>
        </div>
        <div className="info-row">
          <span className="info-key">APILogger</span>
          <span className="info-val mono">{info.contracts?.APILogger?.address}</span>
        </div>
        <div className="info-row">
          <span className="info-key">APIKeyRegistry</span>
          <span className="info-val mono">{info.contracts?.APIKeyRegistry?.address}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Deployed At</span>
          <span className="info-val">{new Date(info.deployedAt).toLocaleString()}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Deployer</span>
          <span className="info-val mono">{info.deployer}</span>
        </div>
      </div>
    </div>
  );
}
