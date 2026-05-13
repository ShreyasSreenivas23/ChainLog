import { useState, useEffect } from 'react';
import { api, shortHash, copyToClipboard } from '../api.js';

const SIGNERS = [
  { index: 1, label: 'Account 1 — PaymentService' },
  { index: 2, label: 'Account 2 — AIMLPlatform' },
  { index: 3, label: 'Account 3 — WeatherDataAPI' },
  { index: 4, label: 'Account 4 — GeoService' },
];

export default function Simulate({ toast, refreshStats }) {
  const [services, setServices] = useState({});
  const [selectedService, setSelectedService] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [signerIndex, setSignerIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    api.services().then(s => {
      setServices(s);
      const first = Object.keys(s)[0];
      if (first) {
        setSelectedService(first);
        setSelectedEndpoint(s[first].endpoints[0].path);
      }
    }).catch(() => {});
  }, []);

  const handleServiceChange = (svc) => {
    setSelectedService(svc);
    setSelectedEndpoint(services[svc]?.endpoints?.[0]?.path || '');
  };

  const simulate = async () => {
    if (!selectedEndpoint) return;
    setLoading(true);
    try {
      const ep = services[selectedService]?.endpoints.find(e => e.path === selectedEndpoint);
      const result = await api.simulate({
        endpoint: selectedEndpoint,
        method: ep?.method || 'GET',
        signerIndex,
      });
      setLastResult(result);
      toast(`✅ Logged: ${ep?.method} ${selectedEndpoint} → ${result.log?.statusCode}`, 'success');
      refreshStats();
    } catch (e) {
      toast(`❌ ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const simulateRandom = async () => {
    setRandomLoading(true);
    try {
      const result = await api.simulateRandom({ signerIndex });
      setLastResult(result);
      toast(`🎲 Random: ${result.log?.method} ${result.log?.endpoint} → ${result.log?.statusCode}`, 'info');
      refreshStats();
    } catch (e) {
      toast(`❌ ${e.message}`, 'error');
    } finally {
      setRandomLoading(false);
    }
  };

  const finalize = async () => {
    setBatchLoading(true);
    try {
      const r = await api.finalizeBatch();
      toast(`🌲 Batch #${r.batchId} finalized! Root: ${r.merkleRoot?.slice(0,12)}…`, 'success');
      refreshStats();
    } catch (e) {
      toast(`❌ ${e.message}`, 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const statusColor = (code) => {
    if (!code) return 'var(--text-muted)';
    if (code >= 200 && code < 300) return 'var(--neon-green)';
    if (code >= 400 && code < 500) return 'var(--neon-orange)';
    return 'var(--neon-red)';
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Simulate API Calls</div>
          <div className="page-subtitle">Each call is hashed (SHA-256), chained, and logged immutably to the blockchain.</div>
        </div>
        <button id="btn-finalize-batch" className="btn btn-success" onClick={finalize} disabled={batchLoading}>
          {batchLoading ? '⏳ Finalizing…' : '🌲 Finalize Batch'}
        </button>
      </div>

      <div className="grid-2">
        {/* Simulator Panel */}
        <div className="card">
          <div className="card-title">⚡ API Call Simulator</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">API Consumer (Signer)</label>
              <select
                id="select-signer"
                className="form-select"
                value={signerIndex}
                onChange={e => setSignerIndex(Number(e.target.value))}
              >
                {SIGNERS.map(s => (
                  <option key={s.index} value={s.index}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Service</label>
              <select
                id="select-service"
                className="form-select"
                value={selectedService}
                onChange={e => handleServiceChange(e.target.value)}
              >
                {Object.entries(services).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Endpoint</label>
              <select
                id="select-endpoint"
                className="form-select"
                value={selectedEndpoint}
                onChange={e => setSelectedEndpoint(e.target.value)}
              >
                {(services[selectedService]?.endpoints || []).map(ep => (
                  <option key={ep.path} value={ep.path}>
                    [{ep.method}] {ep.path} (~{ep.avgTime}ms)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button id="btn-simulate" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                onClick={simulate} disabled={loading || randomLoading} style={{ flex: 1 }}>
                {!loading && '⚡ Log API Call'}
              </button>
              <button id="btn-random" className={`btn btn-ghost ${randomLoading ? 'btn-loading' : ''}`}
                onClick={simulateRandom} disabled={loading || randomLoading}>
                {!randomLoading && '🎲 Random'}
              </button>
            </div>
          </div>
        </div>

        {/* Result Panel */}
        <div className="card">
          <div className="card-title">📋 Log Result</div>
          {!lastResult ? (
            <div className="empty-state">
              <div className="empty-state-icon">📡</div>
              <div className="empty-state-title">No call made yet</div>
              <div className="empty-state-sub">Press "Log API Call" to simulate an API request and record it on-chain.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: statusColor(lastResult.log?.statusCode) }}>
                  {lastResult.log?.statusCode}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lastResult.log?.method} {lastResult.log?.endpoint}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lastResult.log?.responseTimeMs}ms response time</div>
                </div>
              </div>

              <div className="info-panel">
                <InfoRow k="Log ID" v={lastResult.log?.id} />
                <InfoRow k="Caller" v={lastResult.log?.caller} mono />
                <InfoRow k="Request Hash (SHA-256)" v={lastResult.log?.requestHash} mono copyable />
                <InfoRow k="Log Hash (chained)" v={lastResult.log?.logHash} mono copyable />
                <InfoRow k="Tx Hash" v={lastResult.log?.txHash || 'local-only'} mono copyable />
                <InfoRow k="Merkle Root" v={lastResult.merkleRoot} mono copyable />
                <InfoRow k="Total Logs" v={lastResult.totalLogs} />
              </div>

              <div className="alert alert-info" style={{ fontSize: 12 }}>
                <span className="alert-icon">🔗</span>
                <span>This log is cryptographically linked to the previous log via its <strong>prevLogHash</strong>. Tampering with any log breaks the entire chain.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="card-title">🧠 How Immutability Works</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { step: '1', title: 'SHA-256 Hash', desc: 'Each API request body is hashed with SHA-256 to create a fingerprint.' },
            { step: '2', title: 'Hash Chain', desc: 'Every log stores the previous log\'s hash (prevLogHash), creating an unbreakable chain.' },
            { step: '3', title: 'On-Chain Storage', desc: 'The log is stored in a Solidity smart contract — permanent and immutable.' },
            { step: '4', title: 'Merkle Batch', desc: 'Every 10 logs are grouped into a Merkle tree and the root is stored on-chain.' },
          ].map(item => (
            <div key={item.step} style={{
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
              padding: 16, borderLeft: '3px solid var(--accent-primary)'
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-bright)', marginBottom: 6 }}>
                Step {item.step}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ k, v, mono, copyable }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!copyable || !v) return;
    await copyToClipboard(String(v));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="info-row">
      <span className="info-key">{k}</span>
      <span
        className={`info-val${mono ? ' mono' : ''}`}
        style={copyable ? { cursor: 'pointer' } : {}}
        onClick={copy}
        title={copyable ? 'Click to copy' : undefined}
      >
        {v == null || v === '' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : String(v)}
        {copied && <span style={{ marginLeft: 6, color: 'var(--neon-green)', fontSize: 11 }}>✓ Copied</span>}
      </span>
    </div>
  );
}
