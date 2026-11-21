// Tiny API client. Same backend as the mobile app; the logged-in admin's JWT is sent on every call.
export const BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000';
const KEY = 'bhoomiledger_admin_session';

export function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; }
}
export function saveSession(s) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (_) { /* private mode */ }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(path, { method = 'GET', body } = {}) {
  const session = loadSession();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new Error(`Cannot reach the server at ${BASE}. Is the backend running?`);
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new Error((data && data.message) || `Request failed (${res.status})`);
  return data;
}
