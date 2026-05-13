import { useState, useEffect, useCallback } from 'react';
import { api, shortHash, shortAddr, statusVariant, formatTime, copyToClipboard } from '../api.js';

export default function LogExplorer({ toast }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ caller: '', endpoint: '', status: '' });
  const [source, setSource] = useState('cache'); // 'cache' | 'chain'
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (source === 'chain') {
        const r = await api.logsChain();
        setLogs((r.logs || []).reverse());
        setTotal(parseInt(r.total) || 0);
      } else {
        const params = { page, limit: LIMIT };
        if (filter.caller)   params.caller   = filter.caller;
        if (filter.endpoint) params.endpoint = filter.endpoint;
        if (filter.status)   params.status   = filter.status;
        const r = await api.logs(params);
        setLogs(r.logs || []);
        setTotal(r.total || 0);
      }
    } catch (e) {
      toast?.(`❌ ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filter, source, toast]);

  useEffect(() => { load(); }, [load]);

  const copy = async (val) => {
    await copyToClipboard(val);
    toast?.('📋 Copied to clipboard', 'info');
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Log Explorer</div>
          <div className="page-subtitle">Browse all API call records stored immutably on-chain. {total} total logs.</div>
        </div>
        <div className="tabs">
          <button className={`tab ${source === 'cache' ? 'active' : ''}`} onClick={() => { setSource('cache'); setPage(0); }}>
            ⚡ Fast Cache
          </button>
          <button className={`tab ${source === 'chain' ? 'active' : ''}`} onClick={() => { setSource('chain'); setPage(0); }}>
            🔗 Blockchain
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Filter by Endpoint</label>
            <input id="filter-endpoint" className="form-input" placeholder="/api/v1/…"
              value={filter.endpoint} onChange={e => { setFilter(p => ({ ...p, endpoint: e.target.value })); setPage(0); }} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Filter by Caller Address</label>
            <input id="filter-caller" className="form-input" placeholder="0x…"
              value={filter.caller} onChange={e => { setFilter(p => ({ ...p, caller: e.target.value })); setPage(0); }} />
          </div>
          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label">Status Code</label>
            <select id="filter-status" className="form-select"
              value={filter.status} onChange={e => { setFilter(p => ({ ...p, status: e.target.value })); setPage(0); }}>
              <option value="">All</option>
              <option value="200">200</option>
              <option value="201">201</option>
              <option value="400">400</option>
              <option value="429">429</option>
              <option value="500">500</option>
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilter({ caller: '', endpoint: '', status: '' }); setPage(0); }}>
            ✕ Clear
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state"><div className="spinner" /> Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔎</div>
              <div className="empty-state-title">No logs found</div>
              <div className="empty-state-sub">Try clearing filters or simulate some API calls first.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Time (ms)</th>
                  <th>Caller</th>
                  <th>Log Hash</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(selected?.id === log.id ? null : log)}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {log.id}
                    </td>
                    <td>
                      <span className={`badge badge-${log.method === 'POST' ? 'info' : 'purple'}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="td-mono" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.endpoint}
                    </td>
                    <td>
                      <span className={`badge badge-${statusVariant(log.statusCode)}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{log.responseTimeMs}</td>
                    <td className="td-mono" title={log.caller}>{shortAddr(log.caller)}</td>
                    <td>
                      <span className="hash-display" onClick={e => { e.stopPropagation(); copy(log.logHash); }}
                        title="Click to copy">
                        {shortHash(log.logHash)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {formatTime(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {source === 'cache' && pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page + 1} of {pages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next →</button>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="card chain-card">
          <div className="card-title">🔍 Log Detail — #{selected.id}</div>
          <div className="info-panel">
            {[
              ['Log ID', selected.id],
              ['Caller', selected.caller, true],
              ['Endpoint', selected.endpoint, true],
              ['Method', selected.method],
              ['Status Code', selected.statusCode],
              ['Response Time', `${selected.responseTimeMs}ms`],
              ['Request Hash (SHA-256)', selected.requestHash, true],
              ['Prev Log Hash (chain link)', selected.prevLogHash, true],
              ['Log Hash', selected.logHash, true],
              ['Tx Hash', selected.txHash, true],
              ['Timestamp', formatTime(selected.timestamp)],
            ].map(([k, v, m]) => v != null && (
              <div className="info-row" key={k}>
                <span className="info-key">{k}</span>
                <span className={`info-val${m ? ' mono' : ''}`}
                  onClick={() => m && copy(v)} style={m ? { cursor: 'pointer' } : {}}>
                  {String(v) || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
