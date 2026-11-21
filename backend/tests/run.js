/**
 * npm test — runs the regression suite + the new-feature suite end to end.
 *
 * It SEEDS the database it is pointed at (wiping users, lands and audit blocks), so it
 * refuses to run unless you give it a dedicated test database:
 *
 *   TEST_MONGO_URI=mongodb://127.0.0.1:27017/bhoomiledger_test npm test
 *
 * What it starts for you:
 *   • a stub of the Claude API (no real API calls, no key needed)
 *   • the API server with the stub configured       (summaries work)
 *   • a second API server without an API key        (summaries report "not configured")
 */
require('dotenv').config();
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..');
const TEST_URI = process.env.TEST_MONGO_URI;

if (!TEST_URI) {
  console.error('Set TEST_MONGO_URI to a DEDICATED test database (it will be wiped), e.g.\n' +
    '  TEST_MONGO_URI=mongodb://127.0.0.1:27017/bhoomiledger_test npm test');
  process.exit(2);
}
if (TEST_URI === process.env.MONGO_URI) {
  console.error('TEST_MONGO_URI is the same as MONGO_URI. Refusing to wipe your real database.');
  process.exit(2);
}

function freePort() {
  return new Promise(resolve => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

// ── stub of the Claude API ───────────────────────────────────────────────────
function startStub(port) {
  const stub = { requests: [], mode: 'ok' };
  const okBody = JSON.stringify({
    content: [{ type: 'text', text: 'This plot is held by Mohan Lal. The record shows it is clear.' }],
    model: 'stub-model-1', stop_reason: 'end_turn',
  });
  stub.server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      stub.requests.push({ url: req.url, headers: req.headers, body: JSON.parse(raw || '{}') });
      const send = (code, body) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(body); } };
      if (stub.mode === 'error500') return send(500, JSON.stringify({ error: { message: 'secret-upstream-detail' } }));
      if (stub.mode === 'empty') return send(200, JSON.stringify({ content: [], model: 'stub-model-1' }));
      if (stub.mode === 'slow') return setTimeout(() => send(200, okBody), 4000);
      send(200, okBody);
    });
  });
  return new Promise(resolve => stub.server.listen(port, '127.0.0.1', () => resolve(stub)));
}

function startApi(port, extraEnv) {
  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, MONGO_URI: TEST_URI, JWT_SECRET: 'test-secret-not-for-production-0123456789', PORT: String(port), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', d => { if (process.env.VERBOSE) process.stderr.write(d); });
  return child;
}

async function waitReady(base) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(base + '/'); if (r.ok) return; } catch (_) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('API server did not start: ' + base);
}

(async () => {
  const [apiPort, noKeyPort, stubPort] = [await freePort(), await freePort(), await freePort()];
  const stub = await startStub(stubPort);
  const children = [];
  let failed = 0;

  try {
    // fresh data
    const seed = spawnSync('node', ['seed.js'], { cwd: ROOT, env: { ...process.env, MONGO_URI: TEST_URI }, encoding: 'utf8' });
    if (seed.status !== 0) { console.error(seed.stdout, seed.stderr); throw new Error('seed failed'); }

    children.push(startApi(apiPort, {
      ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: `http://127.0.0.1:${stubPort}`,
      ANTHROPIC_TIMEOUT_MS: '1500', SUMMARY_LIMIT_PER_HOUR: '10',
    }));
    children.push(startApi(noKeyPort, { ANTHROPIC_API_KEY: '' }));
    const BASE = `http://127.0.0.1:${apiPort}`;
    const BASE_NOKEY = `http://127.0.0.1:${noKeyPort}`;
    await Promise.all([waitReady(BASE), waitReady(BASE_NOKEY)]);

    await mongoose.connect(TEST_URI);

    console.log('═══ 1/2  REGRESSION — behaviour the mobile app already depends on ═══');
    const reg = await require('./regression')(BASE);
    failed += reg.fail;

    console.log('\n═══ 2/2  NEW FEATURES — audit chain, AI summary, admin API ═══');
    const feat = await require('./features')({ BASE, BASE_NOKEY, stub, root: ROOT, mongoUri: TEST_URI });
    failed += feat.fail;

    console.log(`\n────────────────────────────────────────`);
    console.log(`TOTAL: ${reg.pass + feat.pass} passed, ${failed} failed`);
  } catch (err) {
    console.error('Runner error:', err);
    failed = failed || 1;
  } finally {
    for (const c of children) c.kill();
    stub.server.close();
    await mongoose.disconnect().catch(() => {});
    process.exit(failed ? 1 : 0);
  }
})();
