import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export const STATE_LABEL = {
  intact: ['Intact', 'ok'],
  tampered: ['Mismatch found', 'bad'],
  not_anchored: ['Not anchored yet', 'warn'],
};

export function StateBadge({ state }) {
  const [label, cls] = STATE_LABEL[state] || [state, 'warn'];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [verify, setVerify] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => { api('/admin/stats').then(setStats).catch(e => setError(e.message)); }, []);

  async function runVerify() {
    setVerifying(true); setError('');
    try { setVerify(await api('/admin/audit/verify-all')); }
    catch (e) { setError(e.message); }
    finally { setVerifying(false); }
  }

  return (
    <>
      <h2>Dashboard</h2>
      {error && <div className="alert error" role="alert">{error}</div>}
      {stats && (
        <div className="stat-grid">
          <div className="stat"><b>{stats.lands}</b><span>Land records</span></div>
          <div className="stat"><b>{stats.users.owners}</b><span>Owners</span></div>
          <div className="stat"><b>{stats.users.officials}</b><span>Officials</span></div>
          <div className="stat"><b>{stats.byStatus.disputed}</b><span>Disputed</span></div>
          <div className="stat"><b>{stats.byStatus.under_review}</b><span>Under review</span></div>
          <div className="stat"><b>{stats.auditBlocks}</b><span>Audit blocks</span></div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <div>
            <h3>Record integrity</h3>
            <p className="muted small">Re-computes every audit hash and compares the audit log with the live records.</p>
          </div>
          <span className="spacer" />
          <button className="primary" onClick={runVerify} disabled={verifying}>{verifying ? 'Verifying…' : 'Verify all records'}</button>
        </div>

        {verify && (
          <>
            <p data-testid="verify-summary">
              <b>{verify.summary.total}</b> checked ·{' '}
              <span className="badge ok">{verify.summary.intact} intact</span>{' '}
              <span className="badge bad">{verify.summary.tampered} mismatch</span>{' '}
              <span className="badge warn">{verify.summary.not_anchored} not anchored</span>
              {verify.truncated && <span className="muted small"> (first 1000 plots only)</span>}
            </p>
            {verify.summary.not_anchored > 0 && (
              <p className="muted small">“Not anchored” plots were created before the audit log existed. Run <code>npm run audit:backfill</code> on the server once.</p>
            )}
            <table>
              <thead><tr><th>Plot</th><th>Village</th><th>Blocks</th><th>Result</th></tr></thead>
              <tbody>
                {verify.results.filter(r => r.state !== 'intact').concat(verify.results.filter(r => r.state === 'intact')).map(r => (
                  <tr key={r.id}><td>{r.khasraNo}</td><td>{r.village}</td><td>{r.blocks}</td>
                    <td><StateBadge state={r.state} />{r.issueCount ? <span className="muted small"> · {r.issueCount} finding(s)</span> : null}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
