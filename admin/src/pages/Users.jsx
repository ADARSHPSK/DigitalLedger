import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// Search existing plots and pick one (used when creating an owner and when editing their plots)
function PlotPicker({ onPick, exclude = [] }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    api(`/admin/lands?limit=8&q=${encodeURIComponent(q)}`).then(d => alive && setItems(d.items)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [q]);
  const taken = new Set(exclude.map(p => `${p.khasraNo}|${p.village}`));
  return (
    <div className="picker">
      <input placeholder="Search plots to link (khasra, owner, village)" value={q} onChange={e => setQ(e.target.value)} />
      <ul>
        {items.filter(l => !taken.has(`${l.khasraNo}|${l.village}`)).map(l => (
          <li key={l._id}>
            <span>{l.khasraNo} · {l.village} · <span className="muted">{l.currentOwner}</span></span>
            <button type="button" onClick={() => onPick({ khasraNo: l.khasraNo, village: l.village })}>Link</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Printable credentials slip — the temporary password is shown ONCE, here only.
function Slip({ slip, onClose }) {
  return (
    <div className="card slip" data-testid="slip">
      <h3>BhoomiLedger login</h3>
      <p><b>{slip.name}</b> ({slip.role})</p>
      <p>Phone: <code>{slip.phone}</code></p>
      <p>Password: <code data-testid="slip-password">{slip.password}</code></p>
      <p className="small">Please change this password after your first login.</p>
      <p className="muted small no-print">This password is shown only once. Print it or hand it over now.</p>
      <div className="row no-print">
        <button className="primary" onClick={() => window.print()}>Print slip</button>
        <button onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

const EMPTY = { role: 'owner', name: '', phone: '', designation: '', villages: '', password: '' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [plots, setPlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [slip, setSlip] = useState(null);
  const [managing, setManaging] = useState(null);   // owner whose plots are being edited

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (roleFilter) p.set('role', roleFilter);
      if (q) p.set('q', q);
      const list = await api(`/admin/users?${p}`);
      setUsers(list);
      setManaging(m => (m ? list.find(u => u.id === m.id) || null : m));
    } catch (e) { setError(e.message); }
  }, [roleFilter, q]);
  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { name: form.name, phone: form.phone, role: form.role };
      if (form.password) body.password = form.password;
      if (form.role === 'official') {
        body.designation = form.designation;
        body.assignedVillages = form.villages.split(',').map(s => s.trim()).filter(Boolean);
      } else body.landRefs = plots;
      const r = await api('/admin/users', { method: 'POST', body });
      setSlip({ name: r.user.name, phone: r.user.phone, role: r.user.role, password: r.tempPassword || '(the password you chose)' });
      setForm(EMPTY); setPlots([]); setShowForm(false); load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function resetPassword(u) {
    if (!window.confirm(`Issue a new temporary password for ${u.name}? Their current password will stop working.`)) return;
    try {
      const r = await api(`/admin/users/${u.id}/reset-password`, { method: 'POST' });
      setSlip({ name: u.name, phone: u.phone, role: u.role, password: r.tempPassword });
    } catch (err) { setError(err.message); }
  }

  async function linkPlot(user, action, plot) {
    try { await api(`/admin/users/${user.id}/land-refs`, { method: 'PATCH', body: { action, ...plot } }); await load(); }
    catch (err) { setError(err.message); }
  }

  const canSave = form.name && /^\d{10}$/.test(form.phone) &&
    (form.role === 'owner' || (form.designation && form.villages.trim()));

  return (
    <>
      <div className="row"><h2>Users</h2><span className="spacer" />
        <button className="primary" onClick={() => { setShowForm(s => !s); setSlip(null); }}>{showForm ? 'Close form' : '+ Create user'}</button></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {slip && <Slip slip={slip} onClose={() => setSlip(null)} />}

      {showForm && (
        <form className="card grid" onSubmit={create}>
          <h3 className="span">New user</h3>
          <label>Role<select value={form.role} onChange={set('role')}><option value="owner">Land owner</option><option value="official">Official (Patwari / Inspector)</option></select></label>
          <label>Full name<input value={form.name} onChange={set('name')} /></label>
          <label>Phone (10 digits — this is their login)<input value={form.phone} onChange={set('phone')} inputMode="numeric" maxLength={10} /></label>
          <label>Password <span className="muted small">(leave blank to auto-generate)</span><input value={form.password} onChange={set('password')} /></label>
          {form.role === 'official' ? (
            <>
              <label>Designation<input value={form.designation} onChange={set('designation')} placeholder="Patwari" /></label>
              <label>Assigned villages <span className="muted small">(comma-separated)</span><input value={form.villages} onChange={set('villages')} placeholder="Rampur, Sitapur" /></label>
            </>
          ) : (
            <div className="span">
              <b className="small">Plots linked to this owner</b>
              <div>{plots.map(p => <span key={`${p.khasraNo}|${p.village}`} className="chip">{p.khasraNo} · {p.village}
                <button type="button" aria-label={`remove ${p.khasraNo}`} onClick={() => setPlots(ps => ps.filter(x => x !== p))}>×</button></span>)}
                {!plots.length && <span className="muted small"> none yet</span>}</div>
              <PlotPicker exclude={plots} onPick={p => setPlots(ps => [...ps, p])} />
            </div>
          )}
          <div className="span"><button className="primary" disabled={!canSave || saving}>{saving ? 'Creating…' : 'Create account'}</button></div>
        </form>
      )}

      <div className="row filters">
        <input placeholder="Search name or phone" value={q} onChange={e => setQ(e.target.value)} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All roles</option><option value="owner">Owners</option><option value="official">Officials</option><option value="admin">Admins</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Plots / villages</th><th /></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}{u.mustChangePassword && <span className="badge warn" title="Still on the temporary password">temp pw</span>}</td>
                <td>{u.phone}</td><td>{u.role}{u.designation ? ` · ${u.designation}` : ''}</td>
                <td>{u.role === 'owner' ? `${u.landRefs.length} plot(s)` : u.role === 'official' ? u.assignedVillages.join(', ') : '—'}</td>
                <td className="actions">
                  {u.role === 'owner' && <button onClick={() => setManaging(managing && managing.id === u.id ? null : u)}>Plots</button>}
                  {u.role !== 'admin' && <button onClick={() => resetPassword(u)}>Reset password</button>}
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan="5" className="muted">No users.</td></tr>}
          </tbody>
        </table>
      </div>

      {managing && (
        <div className="card">
          <h3>Plots linked to {managing.name}</h3>
          <div>{managing.landRefs.map(p => <span key={`${p.khasraNo}|${p.village}`} className="chip">{p.khasraNo} · {p.village}
            <button aria-label={`unlink ${p.khasraNo}`} onClick={() => linkPlot(managing, 'remove', p)}>×</button></span>)}
            {!managing.landRefs.length && <span className="muted small">No plots linked.</span>}</div>
          <PlotPicker exclude={managing.landRefs} onPick={p => linkPlot(managing, 'add', p)} />
        </div>
      )}
    </>
  );
}
