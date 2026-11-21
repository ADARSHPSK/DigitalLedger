/**
 * services/auditChain.js — hash-chained audit log (paper §III-H)
 *
 * Every write to a plot's ownershipHistory / officialComments, and every status
 * change, also appends one block to that plot's chain in the AuditBlock collection.
 *
 *   hash(N) = SHA256( canonicalContent | timestamp | hash(N-1) )      (GENESIS for N = 0)
 *
 * verifyLand() does TWO independent checks:
 *   1. CHAIN check   — recompute every hash and every link. Detects edits to the
 *                      audit log itself (altered/missing/reordered blocks).
 *   2. RECORD check  — compare each block's stored content with the live entry in
 *                      the Land document. Detects edits to the land record itself
 *                      (modified/removed/injected entries, wrong owner, wrong status).
 *
 * Both are needed: editing a Land entry directly in the database leaves the audit
 * log internally consistent, so only the RECORD check can notice it.
 *
 * KNOWN LIMIT (same as the paper): the log lives in the same database as the data.
 * An attacker who can rewrite BOTH the data and the whole log (recomputing every
 * hash) is not detected. Anchoring the head hash outside this database fixes that.
 */
const crypto = require('crypto');
const Land = require('../models/Land');
const AuditBlock = require('../models/AuditBlock');

const GENESIS = '0'.repeat(64);
const FORMAT_VERSION = 1;
const MAX_APPEND_ATTEMPTS = 8;

// ── Canonical serialisation ───────────────────────────────────────────────────
// The same entry must always produce exactly the same text, otherwise hashes
// would not match on re-verification. So: fixed fields, sorted keys, ISO dates,
// missing values → null.

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

const iso = d => (d ? new Date(d).toISOString() : null);
const nn = v => (v === undefined ? null : v);
const idStr = v => (v === undefined || v === null ? null : String((v && v._id) || v));

function canonicalOwnership(e) {
  return stableStringify({
    v: FORMAT_VERSION, type: 'ownership',
    entryId: idStr(e._id),
    ownerName: nn(e.ownerName), ownerContact: nn(e.ownerContact),
    transferType: nn(e.transferType), documentRef: nn(e.documentRef),
    recordedBy: nn(e.recordedBy), date: iso(e.date), notes: nn(e.notes),
  });
}

function canonicalComment(c) {
  return stableStringify({
    v: FORMAT_VERSION, type: 'comment',
    entryId: idStr(c._id),
    officialId: idStr(c.officialId), officialName: nn(c.officialName),
    role: nn(c.role), text: nn(c.text), tag: nn(c.tag), createdAt: iso(c.createdAt),
  });
}

function canonicalStatus({ from, to, byId, byName }) {
  return stableStringify({
    v: FORMAT_VERSION, type: 'status',
    from: nn(from), to: nn(to), byId: idStr(byId), byName: nn(byName),
  });
}

// ── Hashing ───────────────────────────────────────────────────────────────────
function computeHash(content, timestamp, prevHash) {
  return crypto
    .createHash('sha256')
    .update(`${content}|${new Date(timestamp).toISOString()}|${prevHash}`)
    .digest('hex');
}

// ── Per-plot write lock ───────────────────────────────────────────────────────
// Makes "write the Land entry, then append its block" happen in one order per plot,
// so block order always equals write order (important for the derived status).
// This protects a single Node process. Running several API instances would need a
// shared lock or a sequencer (the unique {land, seq} index still prevents corruption).
const locks = new Map();
function withLandLock(landId, fn) {
  const key = String(landId);
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(fn);
  const tail = run.then(() => {}, () => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
}

// ── Algorithm 2: AppendAuditBlock ─────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function appendBlock({ landId, type, entryId = null, content }) {
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    const last = await AuditBlock.findOne({ land: landId }).sort({ seq: -1 }).select('seq hash').lean();
    const seq = last ? last.seq + 1 : 0;
    const prevHash = last ? last.hash : GENESIS;
    const timestamp = new Date();
    const hash = computeHash(content, timestamp, prevHash);
    try {
      return await AuditBlock.create({ land: landId, seq, type, entryId, content, timestamp, prevHash, hash });
    } catch (err) {
      if (err && err.code === 11000) { await sleep(5 + Math.random() * 25); continue; } // lost a race → retry
      throw err;
    }
  }
  throw new Error('Could not append audit block (too much contention).');
}

// Helpers used by the routes — `land` is the Mongoose document returned by the update.
function anchorOwnership(land, entryId) {
  const entry = land.ownershipHistory.id(entryId);
  if (!entry) throw new Error('anchorOwnership: entry not found on land document');
  return appendBlock({ landId: land._id, type: 'ownership', entryId, content: canonicalOwnership(entry.toObject()) });
}

function anchorComment(land, entryId) {
  const entry = land.officialComments.id(entryId);
  if (!entry) throw new Error('anchorComment: entry not found on land document');
  return appendBlock({ landId: land._id, type: 'comment', entryId, content: canonicalComment(entry.toObject()) });
}

function anchorStatus(landId, { from, to, byId, byName }) {
  return appendBlock({ landId, type: 'status', content: canonicalStatus({ from, to, byId, byName }) });
}

// Never let an audit failure turn a successful write into an error for the user.
// The record is saved; the missing block will show up as "entry_not_anchored"
// when the plot is verified, and the problem is logged for the operator.
async function safeAnchor(fn) {
  try { await fn(); return true; }
  catch (err) { console.error('[audit] FAILED to anchor write:', err.message); return false; }
}

// ── Derived status ────────────────────────────────────────────────────────────
// What the plot's status SHOULD be according to the log: the last status-changing
// block wins (a tagged comment, or a status block). No such block → 'clear'.
function deriveStatus(blocks) {
  let status = 'clear';
  for (const b of blocks) {
    let c;
    try { c = JSON.parse(b.content); } catch (_) { continue; }
    if (b.type === 'comment' && c.tag) status = c.tag;
    if (b.type === 'status' && c.to) status = c.to;
  }
  return status;
}

// ── VerifyChain ───────────────────────────────────────────────────────────────
const MESSAGES = {
  chain_gap: 'An audit block is missing or out of order.',
  chain_link: 'The link between two audit blocks is broken.',
  chain_hash: 'An audit block was altered after it was written.',
  entry_modified: 'An entry no longer matches what was originally recorded.',
  entry_removed: 'An entry that was recorded has been removed from the record.',
  entry_not_anchored: 'An entry exists in the record but was never written to the audit log.',
  current_owner_mismatch: 'The current owner does not match the last ownership entry.',
  status_mismatch: 'The plot status does not match what the audit log says it should be.',
};

async function verifyLand(landId) {
  const land = await Land.findById(landId).lean();
  if (!land) return null;

  const blocks = await AuditBlock.find({ land: landId }).sort({ seq: 1 }).lean();
  const checkedAt = new Date().toISOString();

  // Legacy plot: written before the audit log existed. Not "tampered" — just not covered yet.
  if (blocks.length === 0) {
    return { state: 'not_anchored', blocks: 0, headHash: null, brokenAt: null, issues: [], checkedAt };
  }

  // 1) CHAIN check — first mismatch wins
  let brokenAt = null;
  let prev = GENESIS;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.seq !== i) { brokenAt = { seq: i, kind: 'chain_gap' }; break; }
    if (b.prevHash !== prev) { brokenAt = { seq: b.seq, kind: 'chain_link' }; break; }
    if (computeHash(b.content, b.timestamp, b.prevHash) !== b.hash) { brokenAt = { seq: b.seq, kind: 'chain_hash' }; break; }
    prev = b.hash;
  }
  if (brokenAt) brokenAt.message = MESSAGES[brokenAt.kind];

  // 2) RECORD check — block content vs live Land document
  const issues = [];
  const liveOwn = new Map((land.ownershipHistory || []).map(e => [String(e._id), e]));
  const liveCom = new Map((land.officialComments || []).map(c => [String(c._id), c]));
  const covered = new Set();

  for (const b of blocks) {
    if (b.type !== 'ownership' && b.type !== 'comment') continue;
    const key = String(b.entryId);
    const live = (b.type === 'ownership' ? liveOwn : liveCom).get(key);
    if (!live) {
      issues.push({ kind: 'entry_removed', seq: b.seq, entryType: b.type, entryId: key });
      continue;
    }
    covered.add(`${b.type}:${key}`);
    const liveCanonical = b.type === 'ownership' ? canonicalOwnership(live) : canonicalComment(live);
    if (liveCanonical !== b.content) {
      issues.push({ kind: 'entry_modified', seq: b.seq, entryType: b.type, entryId: key });
    }
  }
  for (const [key] of liveOwn) {
    if (!covered.has(`ownership:${key}`)) issues.push({ kind: 'entry_not_anchored', entryType: 'ownership', entryId: key });
  }
  for (const [key] of liveCom) {
    if (!covered.has(`comment:${key}`)) issues.push({ kind: 'entry_not_anchored', entryType: 'comment', entryId: key });
  }

  const lastOwner = (land.ownershipHistory || []).slice(-1)[0];
  if (lastOwner && land.currentOwner !== lastOwner.ownerName) {
    issues.push({ kind: 'current_owner_mismatch', expected: lastOwner.ownerName, actual: land.currentOwner });
  }
  const expectedStatus = deriveStatus(blocks);
  if (expectedStatus !== land.status) {
    issues.push({ kind: 'status_mismatch', expected: expectedStatus, actual: land.status });
  }
  for (const i of issues) i.message = MESSAGES[i.kind];

  return {
    state: brokenAt || issues.length ? 'tampered' : 'intact',
    blocks: blocks.length,
    headHash: blocks[blocks.length - 1].hash,
    brokenAt,
    issues,
    checkedAt,
  };
}

// ── Backfill (legacy plots) ───────────────────────────────────────────────────
// Creates a chain for a plot that has none, from its CURRENT contents.
// It only ever runs on plots with zero blocks, so it can never "re-bless" a plot
// whose chain already exists. Blocks carry the anchoring time, not the original
// write time (the entries' own dates are inside the content).
async function backfillLand(landId) {
  const existing = await AuditBlock.countDocuments({ land: landId });
  if (existing > 0) return { skipped: true, reason: 'already has a chain' };

  const land = await Land.findById(landId).lean();
  if (!land) return { skipped: true, reason: 'land not found' };

  const owns = [...(land.ownershipHistory || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const coms = [...(land.officialComments || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const blocks = [];
  for (const e of owns) {
    blocks.push(await appendBlock({ landId, type: 'ownership', entryId: e._id, content: canonicalOwnership(e) }));
  }
  for (const c of coms) {
    blocks.push(await appendBlock({ landId, type: 'comment', entryId: c._id, content: canonicalComment(c) }));
  }
  // If the stored status isn't explained by the entries (it was set directly before
  // the log existed), record it as a baseline so the plot starts out consistent.
  if (deriveStatus(blocks) !== land.status) {
    blocks.push(await anchorStatus(landId, { from: null, to: land.status, byId: null, byName: 'audit backfill (baseline)' }));
  }
  return { skipped: false, blocks: blocks.length };
}

module.exports = {
  GENESIS, stableStringify, canonicalOwnership, canonicalComment, canonicalStatus, computeHash,
  withLandLock, appendBlock, anchorOwnership, anchorComment, anchorStatus, safeAnchor,
  deriveStatus, verifyLand, backfillLand,
};
