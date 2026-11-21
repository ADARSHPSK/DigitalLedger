import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { StateBadge } from './Dashboard.jsx';

const EMPTY = {
  khasraNo: '', village: '', tehsil: '', district: '', areaValue: '', areaUnit: 'bigha',
  landType: 'agricultural', currentOwner: '', documentRef: '', notes: '',
};
const STATUS_CLASS = { clear: 'ok', under_review: 'warn', disputed: 'bad' };

export default function Lands({ adminName }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState({});        // landId -> integrity result
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formMsg, setFormMsg] = useState(null);    // { type, text }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      setData(await api(`/admin/lands?${params}`));
    } catch (e) { setError(e.message); }
  }, [q, status, page]);

  useEffect(() => { load(); }, [load]);

  async function verifyOne(id) {
    try { setChecks(c => ({ ...c, [id]: { ...(c[id] || {}), loading: true } })); const r = await api(`/land/${id}/integrity`); setChecks(c => ({ ...c, [id]: r })); }
    catch (e) { setChecks(c => ({ ...c, [id]: { error: e.message } })); }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setSaving(true); setFormMsg(null);
    try {
      const body = { ...form, areaValue: Number(form.areaValue), recordedBy: adminName };
      const land = await api('/land', { method: 'POST', body });
      setFormMsg({ type: 'ok', text: `Created ${land.khasraNo} (${land.village}). Its audit chain has started.` });
      setForm(EMPTY); setPage(1); load();
    } catch (err) {
      setFormMsg({ type: 'error', text: /E11000|duplicate/i.test(err.message) ? 'A plot with this khasra number already exists in that village.' : err.message });
    } finally { setSaving(false); }
  }

  const canSave = form.khasraNo && form.village && form.tehsil && form.district && form.currentOwner && Number(form.areaValue) > 0;

  return (
    <>
      <div className="row"><h2>Land records</h2><span className="spacer" />
        <button className="primary" onClick={() => setShowForm(s => !s)}>{showForm ? 'Close form' : '+ Add land record'}</button></div>

      {showForm && (
        <form className="card grid" onSubmit={create}>
          <h3 className="span">New land record</h3>
          <label>Khasra no.<input value={form.khasraNo} onChange={set('khasraNo')} /></label>
          <label>Village<input value={form.village} onChange={set('village')} /></label>
          <label>Tehsil<input value={form.tehsil} onChange={set('tehsil')} /></label>
          <label>District<input value={form.district} onChange={set('district')} /></label>
          <label>Area<input type="number" min="0" step="any" value={form.areaValue} onChange={set('areaValue')} /></label>
          <label>Unit<select value={form.areaUnit} onChange={set('areaUnit')}><option>bigha</option><option>hectare</option><option>acre</option></select></label>
          <label>Land type<select value={form.landType} onChange={set('landType')}><option>agricultural</option><option>residential</option><option>commercial</option><option>govt</option></select></label>
          <label>First (original) owner<input value={form.currentOwner} onChange={set('currentOwner')} /></label>
          <label>Document ref. (patta / deed no.)<input value={form.documentRef} onChange={set('documentRef')} /></label>
          <label className="span">Notes<input value={form.notes} onChange={set('notes')} /></label>
          {formMsg && <div className={`alert ${formMsg.type === 'ok' ? 'success' : 'error'} span`} role="status">{formMsg.text}</div>}
          <div className="span"><button className="primary" disabled={!canSave || saving}>{saving ? 'Saving…' : 'Create record'}</button></div>
        </form>
      )}

      <div className="row filters">
        <input placeholder="Search khasra no., owner or village" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="clear">Clear</option><option value="under_review">Under review</option><option value="disputed">Disputed</option>
        </select>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}

      {data && (
        <div className="card">
          <table>
            <thead><tr><th>Khasra</th><th>Village</th><th>Owner</th><th>Area</th><th>Status</th><th>Integrity</th></tr></thead>
            <tbody>
              {data.items.map(l => {
                const c = checks[l._id];
                return (
                  <tr key={l._id}>
                    <td>{l.khasraNo}</td><td>{l.village}</td><td>{l.currentOwner}</td><td>{l.areaValue} {l.areaUnit}</td>
                    <td><span className={`badge ${STATUS_CLASS[l.status] || 'warn'}`}>{l.status}</span></td>
                    <td>
                      {!c && <button onClick={() => verifyOne(l._id)}>Verify</button>}
                      {c && c.loading && <span className="muted small">Checking…</span>}
                      {c && c.error && <span className="badge bad">{c.error}</span>}
                      {c && c.state && <><StateBadge state={c.state} /> <span className="muted small">{c.blocks} blocks</span>
                        {c.state === 'tampered' && <ul className="issues">{c.brokenAt && <li>{c.brokenAt.message}</li>}{c.issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}</>}
                    </td>
                  </tr>
                );
              })}
              {!data.items.length && <tr><td colSpan="6" className="muted">No records found.</td></tr>}
            </tbody>
          </table>
          <div className="row pager">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className="muted small">Page {data.page} of {data.pages} · {data.total} records</span>
            <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
