/**
 * BhoomiLedger — regression test for the ORIGINAL API behaviour.
 *
 * Purpose: prove that new features (audit chain, AI summary, admin API) did not
 * change anything the mobile app already depends on.
 *
 * Usage (server must be running on a freshly seeded database):
 *   node seed.js && npm start          # in one terminal
 *   BASE=http://localhost:3000 node tests/regression.js
 */
async function run(BASE) {
let pass = 0, fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* non-JSON */ }
  return { status: res.status, data };
}

async function login(phone, password) {
  const r = await call('POST', '/auth/login', { phone, password });
  return r.data.token;
}

  console.log(`Regression run against ${BASE}\n`);

  // ── health ──────────────────────────────────────────────────────────────
  let r = await call('GET', '/');
  check('GET / health', r.status === 200 && r.data.status === 'BhoomiLedger API running');

  // ── auth ────────────────────────────────────────────────────────────────
  r = await call('POST', '/auth/register', { name: 'Test Owner', phone: '9000000001', password: 'pw12345' });
  check('register -> 201 + token + role owner', r.status === 201 && r.data.token && r.data.user.role === 'owner');
  r = await call('POST', '/auth/register', { name: 'Dup', phone: '9000000001', password: 'x' });
  check('register duplicate phone -> 400', r.status === 400 && r.data.message === 'Phone already registered.');
  r = await call('POST', '/auth/register', { name: 'Sneaky', phone: '9000000002', password: 'x', role: 'admin' });
  check('register cannot self-assign admin role', r.status === 201 && r.data.user.role === 'owner');

  r = await call('POST', '/auth/login', { phone: '1111111111', password: 'officer123' });
  check('login official -> role official', r.status === 200 && r.data.user.role === 'official' && !!r.data.token);
  check('login response has user.id/name/role', !!(r.data.user.id && r.data.user.name && r.data.user.role));
  r = await call('POST', '/auth/login', { phone: '1111111111', password: 'wrong' });
  check('login wrong password -> 401', r.status === 401 && r.data.message === 'Phone or password incorrect.');
  r = await call('POST', '/auth/login', { phone: '0000009999', password: 'wrong' });
  check('login unknown phone -> 401', r.status === 401);

  const tOfficial = await login('1111111111', 'officer123');
  const tOwner1 = await login('2222222222', 'user123');
  const tOwner2 = await login('3333333333', 'user123');
  const tAdmin = await login('0000000000', 'admin123');

  // ── search (public) ─────────────────────────────────────────────────────
  r = await call('GET', '/land/search?q=rampur');
  check('search q=rampur (no auth) -> 4 plots', r.status === 200 && r.data.length === 4, `got ${r.data && r.data.length}`);
  r = await call('GET', '/land/search?status=disputed');
  check('search status=disputed -> 2 plots', r.status === 200 && r.data.length === 2, `got ${r.data && r.data.length}`);
  r = await call('GET', '/land/search?village=sitapur');
  check('search village=sitapur -> 2 plots', r.data.length === 2);
  check('search result fields', r.data[0].khasraNo && r.data[0].village && r.data[0]._id && !r.data[0].ownershipHistory);

  // ── my lands ────────────────────────────────────────────────────────────
  r = await call('GET', '/land/my/lands', null, tOwner1);
  check('my/lands owner1 -> 2 plots', r.status === 200 && r.data.length === 2);
  r = await call('GET', '/land/my/lands', null, tOwner2);
  check('my/lands owner2 -> 1 plot', r.status === 200 && r.data.length === 1);
  r = await call('GET', '/land/my/lands');
  check('my/lands without token -> 401', r.status === 401);

  // ── flagged ─────────────────────────────────────────────────────────────
  r = await call('GET', '/land/official/flagged', null, tOfficial);
  check('flagged as official -> 3 plots', r.status === 200 && r.data.length === 3, `got ${r.data && r.data.length}`);
  r = await call('GET', '/land/official/flagged', null, tOwner1);
  check('flagged as owner -> 403', r.status === 403);
  r = await call('GET', '/land/official/flagged');
  check('flagged without token -> 401', r.status === 401);

  // ── detail + owner RBAC ─────────────────────────────────────────────────
  const mine = (await call('GET', '/land/my/lands', null, tOwner1)).data;
  const kh101 = mine.find(l => l.khasraNo === 'KH-101');
  r = await call('GET', `/land/${kh101._id}`, null, tOwner1);
  check('detail own plot: full history (2 events)', r.status === 200 && r.data.ownershipHistory.length === 2 && !r.data._isRestricted);

  const sitapur = (await call('GET', '/land/search?q=KH-201')).data[0];
  r = await call('GET', `/land/${sitapur._id}`, null, tOwner1);
  check('detail not-own plot: restricted + history stripped',
    r.status === 200 && r.data._isRestricted === true && r.data.ownershipHistory.length === 0 && r.data.officialComments.length === 0);

  r = await call('GET', `/land/${kh101._id}`, null, tOfficial);
  check('detail as official -> full', r.status === 200 && r.data.ownershipHistory.length === 2);
  r = await call('GET', '/land/000000000000000000000000', null, tOfficial);
  check('detail unknown id -> 404', r.status === 404);
  r = await call('GET', `/land/${kh101._id}`);
  check('detail without token -> 401', r.status === 401);

  // ── create land (admin only) ────────────────────────────────────────────
  const newLand = {
    khasraNo: 'KH-900', village: 'Rampur', tehsil: 'Rampur Tehsil', district: 'Rampur',
    areaValue: 1.5, areaUnit: 'bigha', landType: 'agricultural',
    currentOwner: 'Test Farmer', documentRef: 'PATTA-T-1', recordedBy: 'Admin',
  };
  r = await call('POST', '/land', newLand, tOfficial);
  check('create land as official -> 403', r.status === 403);
  r = await call('POST', '/land', newLand, tAdmin);
  check('create land as admin -> 201 + original entry',
    r.status === 201 && r.data.ownershipHistory.length === 1 && r.data.ownershipHistory[0].transferType === 'original' && r.data.status === 'clear');
  const newId = r.data._id;
  r = await call('POST', '/land', newLand, tAdmin);
  check('create duplicate khasra+village -> 400', r.status === 400);

  // ── transfer ────────────────────────────────────────────────────────────
  const transferBody = { ownerName: 'New Buyer', transferType: 'sale', date: '2026-01-10', documentRef: 'SALE-T-1', notes: 'test' };
  r = await call('POST', `/land/${newId}/transfer`, transferBody, tOwner1);
  check('transfer as owner -> 403', r.status === 403);
  r = await call('POST', `/land/${newId}/transfer`, transferBody, tOfficial);
  check('transfer as official -> appended, currentOwner updated, recordedBy set',
    r.status === 200 && r.data.currentOwner === 'New Buyer' && r.data.ownershipHistory.length === 2 && r.data.ownershipHistory[1].recordedBy === 'Ram Singh');
  check('transfer keeps previous entry intact', r.data.ownershipHistory[0].ownerName === 'Test Farmer' && r.data.ownershipHistory[0].transferType === 'original');
  r = await call('POST', `/land/${newId}/transfer`, { ownerName: 'X', transferType: 'bogus', date: '2026-01-10' }, tOfficial);
  check('transfer invalid type -> 400', r.status === 400);
  r = await call('POST', '/land/000000000000000000000000/transfer', transferBody, tOfficial);
  check('transfer unknown land -> 404', r.status === 404);

  // ── comment ─────────────────────────────────────────────────────────────
  r = await call('POST', `/land/${newId}/comment`, { text: 'plain note' }, tOfficial);
  check('comment without tag: appended, status unchanged', r.status === 200 && r.data.officialComments.length === 1 && r.data.status === 'clear');
  r = await call('POST', `/land/${newId}/comment`, { text: 'boundary dispute', tag: 'disputed' }, tOfficial);
  check('comment with tag: appended + status set atomically',
    r.status === 200 && r.data.officialComments.length === 2 && r.data.status === 'disputed' && r.data.officialComments[1].tag === 'disputed');
  check('comment stores official name', r.data.officialComments[1].officialName === 'Ram Singh');
  r = await call('POST', `/land/${newId}/comment`, { text: 'x', tag: 'nonsense' }, tOfficial);
  check('comment invalid tag -> 400', r.status === 400);
  r = await call('POST', `/land/${newId}/comment`, { text: 'x' }, tOwner1);
  check('comment as owner -> 403', r.status === 403);

  // ── status patch ────────────────────────────────────────────────────────
  r = await call('PATCH', `/land/${newId}/status`, { status: 'under_review' }, tOfficial);
  check('PATCH status valid -> {status}', r.status === 200 && r.data.status === 'under_review' && Object.keys(r.data).length === 1);
  r = await call('PATCH', `/land/${newId}/status`, { status: 'weird' }, tOfficial);
  check('PATCH status invalid -> 400', r.status === 400);
  r = await call('PATCH', `/land/${newId}/status`, { status: 'clear' }, tOwner1);
  check('PATCH status as owner -> 403', r.status === 403);

  console.log(`\n${pass} passed, ${fail} failed`);
  return { pass, fail };
}

module.exports = run;

if (require.main === module) {
  run(process.env.BASE || 'http://localhost:3000')
    .then(r => process.exit(r.fail ? 1 : 0))
    .catch(e => { console.error('Test crashed:', e); process.exit(2); });
}
