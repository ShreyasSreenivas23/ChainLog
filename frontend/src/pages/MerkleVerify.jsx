import { useState, useEffect } from 'react';
import { api, shortHash, copyToClipboard } from '../api.js';

export default function MerkleVerify({ toast }) {
  const [merkle, setMerkle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLeaf, setSelectedLeaf] = useState(null);
  const [proof, setProof] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const m = await api.merkle();
      setMerkle(m);
      setSelectedLeaf(null);
      setProof(null);
      setVerifyResult(null);
    } catch (e) {
      toast?.(`❌ ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getProof = async (index) => {
    setProofLoading(true);
    setVerifyResult(null);
    try {
      const p = await api.merkleProof(index);
      setProof(p);
      setSelectedLeaf(index);
    } catch (e) {
      toast?.(`❌ ${e.message}`, 'error');
    } finally {
      setProofLoading(false);
    }
  };

  const verifyProof = async () => {
    if (!proof) return;
    try {
      const r = await api.merkleVerify({
        proof: proof.proof,
        leaf: proof.leaf,
        root: proof.root,
      });
      setVerifyResult(r.valid);
      toast?.(r.valid ? '✅ Proof is VALID — log is authentic' : '❌ Proof is INVALID — tampering detected!',
        r.valid ? 'success' : 'error');
    } catch (e) {
      toast?.(`❌ ${e.message}`, 'error');
    }
  };

  const copy = async (val) => {
    await copyToClipboard(val);
    toast?.('📋 Copied!', 'info');
  };

  if (loading) return (
    <div className="page"><div className="loading-state"><div className="spinner" /> Loading Merkle tree…</div></div>
  );

  const leaves = merkle?.leaves || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Merkle Tree Verifier</div>
          <div className="page-subtitle">
            Cryptographically verify any log entry is authentic using Merkle proofs.
            {merkle?.leafCount > 0 && ` ${merkle.leafCount} leaves in current batch.`}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh Tree</button>
      </div>

      {leaves.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🌿</div>
            <div className="empty-state-title">No leaves in current batch</div>
            <div className="empty-state-sub">
              Simulate some API calls to add leaves to the Merkle tree.
              After 10 calls, the batch auto-finalizes.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Root Display */}
          <div className="card chain-card">
            <div className="card-title">🌲 Current Merkle Root</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                color: 'var(--accent-bright)', wordBreak: 'break-all',
                background: 'var(--bg-surface)', padding: '10px 16px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glow)',
                flex: 1, cursor: 'pointer'
              }} onClick={() => copy(merkle?.root)}>
                {merkle?.root || '—'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Leaves</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon-green)' }}>{leaves.length}</div>
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* Leaf List */}
            <div className="card">
              <div className="card-title">🍃 Leaf Nodes (select to prove)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {leaves.map((leaf, i) => (
                  <div key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      background: selectedLeaf === i ? 'var(--accent-light)' : 'var(--bg-surface)',
                      border: `1px solid ${selectedLeaf === i ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onClick={() => getProof(i)}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: selectedLeaf === i ? 'var(--accent-primary)' : 'var(--bg-raised)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: selectedLeaf === i ? 'white' : 'var(--text-muted)',
                      flexShrink: 0
                    }}>
                      {i}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neon-green)' }}>
                        {shortHash(leaf.sha256Hash, 10)}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {shortHash(leaf.leaf, 8)}
                      </div>
                    </div>
                    {selectedLeaf === i && <span style={{ color: 'var(--accent-bright)', fontSize: 14 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Proof Panel */}
            <div className="card">
              <div className="card-title">🔐 Merkle Proof</div>
              {proofLoading ? (
                <div className="loading-state"><div className="spinner" /> Generating proof…</div>
              ) : !proof ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👈</div>
                  <div className="empty-state-title">Select a leaf</div>
                  <div className="empty-state-sub">Click any leaf on the left to generate its Merkle proof.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="info-panel">
                    <div className="info-row">
                      <span className="info-key">Leaf Index</span>
                      <span className="info-val">{proof.index}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Leaf Hash</span>
                      <span className="info-val mono" style={{ cursor: 'pointer' }}
                        onClick={() => copy(proof.leaf)}>{shortHash(proof.leaf, 12)} ⧉</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Merkle Root</span>
                      <span className="info-val mono" style={{ cursor: 'pointer' }}
                        onClick={() => copy(proof.root)}>{shortHash(proof.root, 12)} ⧉</span>
                    </div>
                    <div className="info-row">
                      <span className="info-key">Proof Steps</span>
                      <span className="info-val">{proof.proof.length} sibling hashes</span>
                    </div>
                  </div>

                  {/* Proof Path */}
                  {proof.proof.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Proof Path (sibling hashes)
                      </div>
                      {proof.proof.map((h, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', marginBottom: 4,
                          background: 'var(--bg-surface)', borderRadius: 6,
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 20 }}>#{i}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-code)', flex: 1 }}>
                            {shortHash(h, 10)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button id="btn-verify-proof" className="btn btn-primary" onClick={verifyProof}>
                    🔍 Verify Authenticity
                  </button>

                  {verifyResult !== null && (
                    <div className={`verify-result ${verifyResult ? 'valid' : 'invalid'}`}>
                      <span className="verify-result-icon">{verifyResult ? '✅' : '❌'}</span>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {verifyResult ? 'Log is AUTHENTIC' : 'Verification FAILED'}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 400, marginTop: 3 }}>
                          {verifyResult
                            ? 'The Merkle proof validates correctly against the tree root. This log has not been tampered with.'
                            : 'The proof does not match the Merkle root. Data integrity breach detected!'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tree Visualization */}
          {merkle?.treeVisualization && (
            <div className="card">
              <div className="card-title">🌳 Tree Visualization</div>
              <pre style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-code)',
                background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-sm)',
                overflow: 'auto', maxHeight: 300, lineHeight: 1.6
              }}>
                {merkle.treeVisualization}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
