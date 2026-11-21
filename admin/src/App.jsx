import React, { useEffect, useState } from 'react';
import { api, loadSession, saveSession, setUnauthorizedHandler, BASE } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Lands from './pages/Lands.jsx';
import Users from './pages/Users.jsx';

function Login({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { phone, password } });
      if (data.user.role !== 'admin') throw new Error('This panel is for administrators only.');
      onLogin({ token: data.token, user: data.user });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <h1>BhoomiLedger</h1>
        <p className="muted">Administrator sign-in</p>
        <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="numeric" autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="primary" disabled={busy || !phone || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small">API: {BASE}</p>
      </form>
    </div>
  );
}

const TABS = [['dashboard', 'Dashboard'], ['lands', 'Land records'], ['users', 'Users']];

export default function App() {
  const [session, setSession] = useState(loadSession());
  const [tab, setTab] = useState('dashboard');

  function logout() { saveSession(null); setSession(null); }
  useEffect(() => { setUnauthorizedHandler(logout); }, []);

  if (!session) return <Login onLogin={s => { saveSession(s); setSession(s); }} />;

  return (
    <div className="shell">
      <header className="topbar">
        <strong>BhoomiLedger <span className="muted">Admin</span></strong>
        <nav>
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>
        <span className="spacer" />
        <span className="muted small">{session.user.name}</span>
        <button onClick={logout}>Sign out</button>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'lands' && <Lands adminName={session.user.name} />}
        {tab === 'users' && <Users />}
      </main>
    </div>
  );
}
