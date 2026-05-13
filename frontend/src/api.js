// API helpers — all calls go to the Express backend on port 3001
const BASE = 'http://localhost:3001';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health:          ()       => apiFetch('/health'),
  stats:           ()       => apiFetch('/api/stats'),
  services:        ()       => apiFetch('/api/services'),
  deployment:      ()       => apiFetch('/api/deployment'),
  logs:            (params) => apiFetch('/api/logs?' + new URLSearchParams(params || {})),
  logsChain:       ()       => apiFetch('/api/logs/chain'),
  simulate:        (body)   => apiFetch('/api/simulate',        { method: 'POST', body: JSON.stringify(body) }),
  simulateRandom:  (body)   => apiFetch('/api/simulate/random', { method: 'POST', body: JSON.stringify(body) }),
  merkle:          ()       => apiFetch('/api/merkle'),
  merkleProof:     (index)  => apiFetch(`/api/merkle/proof/${index}`),
  merkleVerify:    (body)   => apiFetch('/api/merkle/verify',   { method: 'POST', body: JSON.stringify(body) }),
  consumers:       ()       => apiFetch('/api/consumers'),
  registerConsumer:(body)   => apiFetch('/api/consumers/register', { method: 'POST', body: JSON.stringify(body) }),
  revokeConsumer:  (body)   => apiFetch('/api/consumers/revoke',   { method: 'POST', body: JSON.stringify(body) }),
  batches:         ()       => apiFetch('/api/batches'),
  finalizeBatch:   ()       => apiFetch('/api/batch/finalize',  { method: 'POST', body: JSON.stringify({}) }),
};

// Shorten a hash for display
export function shortHash(h, len = 8) {
  if (!h) return '—';
  const clean = h.replace('0x', '');
  return `0x${clean.slice(0, len)}…${clean.slice(-4)}`;
}

// Format timestamp
export function formatTime(ts) {
  if (!ts) return '—';
  const n = typeof ts === 'string' ? parseInt(ts) : ts;
  const d = n > 1e10 ? new Date(n) : new Date(n * 1000);
  return d.toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

// Format address
export function shortAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Status code badge variant
export function statusVariant(code) {
  const c = parseInt(code);
  if (c >= 200 && c < 300) return 'success';
  if (c >= 400 && c < 500) return 'warning';
  if (c >= 500) return 'danger';
  return 'neutral';
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

// Time ago
export function timeAgo(ts) {
  const n = typeof ts === 'string' ? parseInt(ts) : ts;
  const d = n > 1e10 ? n : n * 1000;
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
