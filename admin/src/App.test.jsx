import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App.jsx';

// ── a tiny fake of the BhoomiLedger API ──────────────────────────────────────
function fakeApi() {
  const calls = [];
  const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  const impl = (url, opts = {}) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ method, path, body, auth: opts.headers && opts.headers.Authorization });

    if (path === '/auth/login') {
      if (body.phone === '2222222222') return json(200, { token: 't-owner', user: { id: 'o', name: 'Owner', role: 'owner' } });
      if (body.phone === '0000000000' && body.password === 'admin123') return json(200, { token: 't-admin', user: { id: 'a', name: 'Admin', role: 'admin' } });
      return json(401, { message: 'Phone or password incorrect.' });
    }
    if (path === '/admin/stats') return json(200, { lands: 6, byStatus: { clear: 3, under_review: 1, disputed: 2 }, users: { owners: 2, officials: 1, admins: 1 }, auditBlocks: 15 });
    if (path === '/admin/audit/verify-all') return json(200, {
      summary: { total: 2, intact: 1, tampered: 1, not_anchored: 0 }, truncated: false,
      results: [{ id: 'x1', khasraNo: 'KH-103', village: 'Rampur', state: 'tampered', blocks: 4, issueCount: 1 },
                { id: 'x2', khasraNo: 'KH-101', village: 'Rampur', state: 'intact', blocks: 2, issueCount: 0 }],
    });
    if (path.startsWith('/admin/users') && method === 'GET') return json(200, [
      { id: 'u1', name: 'Mohan Lal', phone: '2222222222', role: 'owner', landRefs: [{ khasraNo: 'KH-101', village: 'Rampur' }], assignedVillages: [], mustChangePassword: false },
    ]);
    if (path === '/admin/users' && method === 'POST') return json(201, {
      user: { id: 'u2', name: body.name, phone: body.phone, role: body.role, assignedVillages: body.assignedVillages || [], landRefs: [] },
      tempPassword: 'Xk7mQ2pR',
    });
    if (path.startsWith('/admin/lands')) return json(200, { items: [], total: 0, page: 1, pages: 1 });
    return json(404, { message: 'not found: ' + path });
  };
  return { impl, calls };
}

let api;
beforeEach(() => {
  localStorage.clear();
  api = fakeApi();
  vi.stubGlobal('fetch', vi.fn(api.impl));
});

async function signIn(user, phone, pw) {
  await user.type(screen.getByLabelText('Phone'), phone);
  await user.type(screen.getByLabelText('Password'), pw);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('admin panel', () => {
  it('rejects a non-admin account', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signIn(user, '2222222222', 'user123');
    expect((await screen.findByRole('alert')).textContent).toContain('administrators only');
    expect(localStorage.getItem('bhoomiledger_admin_session')).toBeNull();
  });

  it('shows a wrong-password error from the server', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signIn(user, '0000000000', 'nope');
    expect((await screen.findByRole('alert')).textContent).toContain('Phone or password incorrect.');
  });

  it('admin logs in, sees stats, and verify-all lists the mismatch first', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signIn(user, '0000000000', 'admin123');
    await screen.findByRole('button', { name: 'Land records' });                    // admin shell is showing
    await waitFor(() => expect(screen.getByText('15')).toBeTruthy());               // audit blocks stat
    expect(api.calls.find(c => c.path === '/admin/stats').auth).toBe('Bearer t-admin');

    await user.click(screen.getByRole('button', { name: 'Verify all records' }));
    const summary = await screen.findByTestId('verify-summary');
    expect(summary.textContent).toContain('2 checked');
    expect(summary.textContent).toContain('1 mismatch');
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('KH-103')).toBeTruthy();          // tampered plot first
    expect(within(rows[0]).getByText('Mismatch found')).toBeTruthy();
  });

  it('creates an official and shows the one-time credentials slip', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signIn(user, '0000000000', 'admin123');
    await user.click(await screen.findByRole('button', { name: 'Users' }));
    await user.click(await screen.findByRole('button', { name: '+ Create user' }));

    await user.selectOptions(screen.getByLabelText('Role'), 'official');
    await user.type(screen.getByLabelText('Full name'), 'Sita Devi');
    await user.type(screen.getByLabelText(/^Phone/), '9876543210');
    await user.type(screen.getByLabelText('Designation'), 'Patwari');
    await user.type(screen.getByLabelText(/Assigned villages/), 'Rampur, Sitapur');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect((await screen.findByTestId('slip-password')).textContent).toBe('Xk7mQ2pR');
    const post = api.calls.find(c => c.method === 'POST' && c.path === '/admin/users');
    expect(post.body).toEqual({ name: 'Sita Devi', phone: '9876543210', role: 'official', designation: 'Patwari', assignedVillages: ['Rampur', 'Sitapur'] });
  });

  it('keeps "Create account" disabled until the phone has 10 digits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await signIn(user, '0000000000', 'admin123');
    await user.click(await screen.findByRole('button', { name: 'Users' }));
    await user.click(await screen.findByRole('button', { name: '+ Create user' }));
    await user.type(screen.getByLabelText('Full name'), 'Ravi');
    await user.type(screen.getByLabelText(/^Phone/), '12345');
    expect(screen.getByRole('button', { name: 'Create account' }).disabled).toBe(true);
  });
});
