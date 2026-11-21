const router = require('express').Router();
const crypto = require('crypto');
const Land = require('../models/Land');
const User = require('../models/User');
const AuditBlock = require('../models/AuditBlock');
const { protect, requireRole } = require('../middleware/auth');
const audit = require('../services/auditChain');

// Everything in this file is admin-only. (Land CREATION lives in routes/land.js: POST /land.)
router.use(protect, requireRole('admin'));

// ── helpers ───────────────────────────────────────────────────────────────────
const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Temporary passwords are meant to be read off a printed slip, so skip look-alike
// characters (0/O, 1/l/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

function publicUser(u) {
  return {
    id: u._id, name: u.name, phone: u.phone, role: u.role,
    designation: u.designation || null,
    assignedVillages: u.assignedVillages || [],
    landRefs: (u.landRefs || []).map(r => ({ khasraNo: r.khasraNo, village: r.village })),
    mustChangePassword: !!u.mustChangePassword,
    createdAt: u.createdAt,
  };
}

const cleanStrings = arr =>
  [...new Set((Array.isArray(arr) ? arr : []).map(v => String(v).trim()).filter(Boolean))];

// ── GET /admin/stats ──────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [lands, clear, underReview, disputed, owners, officials, admins, auditBlocks] = await Promise.all([
      Land.countDocuments({}),
      Land.countDocuments({ status: 'clear' }),
      Land.countDocuments({ status: 'under_review' }),
      Land.countDocuments({ status: 'disputed' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'official' }),
      User.countDocuments({ role: 'admin' }),
      AuditBlock.countDocuments({}),
    ]);
    res.json({ lands, byStatus: { clear, under_review: underReview, disputed }, users: { owners, officials, admins }, auditBlocks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /admin/lands?q=&status=&page=&limit= ──────────────────────────────────
router.get('/lands', async (req, res) => {
  try {
    const { q, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filter = {};
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ khasraNo: rx }, { currentOwner: rx }, { village: rx }];
    }

    const [total, items] = await Promise.all([
      Land.countDocuments(filter),
      Land.find(filter)
        .select('khasraNo village tehsil district currentOwner areaValue areaUnit landType status updatedAt')
        .sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /admin/users?role=&q= ─────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { role, q } = req.query;
    const filter = {};
    if (['owner', 'official', 'admin'].includes(role)) filter.role = role;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { phone: rx }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(users.map(publicUser));       // publicUser never includes the password hash
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /admin/users ─────────────────────────────────────────────────────────
// Create an owner or official account and (optionally) link plots to an owner.
// Body: { name, phone, role: 'owner'|'official',
//         designation, assignedVillages[]      ← officials
//         landRefs: [{khasraNo, village}]      ← owners (each plot must already exist)
//         password? }                          ← omit to auto-generate a temporary one
// The temporary password is returned ONCE here and is never retrievable again.
router.post('/users', async (req, res) => {
  try {
    const { name, phone, role, designation, password } = req.body;

    if (!name || !String(name).trim() || String(name).length > 100) {
      return res.status(400).json({ message: 'A name (up to 100 characters) is required.' });
    }
    if (!/^\d{10}$/.test(String(phone || ''))) {
      return res.status(400).json({ message: 'Phone must be exactly 10 digits.' });
    }
    // Admin accounts are intentionally NOT creatable here (least privilege) — use the seed script / database.
    if (!['owner', 'official'].includes(role)) {
      return res.status(400).json({ message: "Role must be 'owner' or 'official'." });
    }
    if (password !== undefined && String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const doc = { name: String(name).trim(), phone: String(phone), role, mustChangePassword: true };

    if (role === 'official') {
      const villages = cleanStrings(req.body.assignedVillages);
      if (!villages.length) return res.status(400).json({ message: 'An official needs at least one assigned village.' });
      if (!designation || !String(designation).trim()) return res.status(400).json({ message: 'An official needs a designation (e.g. Patwari).' });
      doc.assignedVillages = villages;
      doc.designation = String(designation).trim();
    } else {
      const refs = Array.isArray(req.body.landRefs) ? req.body.landRefs : [];
      const missing = [];
      const seen = new Set();
      const clean = [];
      for (const r of refs) {
        const khasraNo = String((r && r.khasraNo) || '').trim();
        const village = String((r && r.village) || '').trim();
        const key = `${khasraNo}|${village}`;
        if (!khasraNo || !village || seen.has(key)) continue;
        seen.add(key);
        const exists = await Land.exists({ khasraNo, village });
        if (exists) clean.push({ khasraNo, village }); else missing.push(`${khasraNo} (${village})`);
      }
      if (missing.length) return res.status(400).json({ message: `These plots do not exist: ${missing.join(', ')}` });
      doc.landRefs = clean;
    }

    if (await User.exists({ phone: doc.phone })) return res.status(409).json({ message: 'Phone already registered.' });

    const generated = password === undefined;
    doc.password = generated ? generatePassword() : String(password);
    const user = await User.create(doc);

    res.status(201).json({ user: publicUser(user), ...(generated ? { tempPassword: doc.password } : {}) });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'Phone already registered.' });
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /admin/users/:id/land-refs ──────────────────────────────────────────
// Link or unlink one plot on an OWNER account.   Body: { action: 'add'|'remove', khasraNo, village }
// (This is account↔plot linkage, not ledger data, so removing a link is allowed.)
router.patch('/users/:id/land-refs', async (req, res) => {
  try {
    const { action } = req.body;
    const khasraNo = String(req.body.khasraNo || '').trim();
    const village = String(req.body.village || '').trim();
    if (!['add', 'remove'].includes(action) || !khasraNo || !village) {
      return res.status(400).json({ message: "Send action ('add' or 'remove'), khasraNo and village." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role !== 'owner') return res.status(400).json({ message: 'Plots can only be linked to owner accounts.' });

    const linked = user.landRefs.some(r => r.khasraNo === khasraNo && r.village === village);

    if (action === 'add') {
      if (!(await Land.exists({ khasraNo, village }))) return res.status(400).json({ message: `Plot ${khasraNo} (${village}) does not exist.` });
      if (linked) return res.status(409).json({ message: 'That plot is already linked to this owner.' });
      user.landRefs.push({ khasraNo, village });
    } else {
      if (!linked) return res.status(404).json({ message: 'That plot is not linked to this owner.' });
      user.landRefs = user.landRefs.filter(r => !(r.khasraNo === khasraNo && r.village === village));
    }
    await user.save();
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /admin/users/:id/reset-password ──────────────────────────────────────
// For a lost slip. Issues a new temporary password (shown once) and forces a change at next login.
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Admin passwords cannot be reset from here.' });

    const tempPassword = generatePassword();
    user.password = tempPassword;
    user.mustChangePassword = true;
    await user.save();
    res.json({ user: publicUser(user), tempPassword });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /admin/audit/verify-all ───────────────────────────────────────────────
// Runs VerifyChain on every plot. Plots written before the audit log existed show up as
// 'not_anchored' (fix with:  npm run audit:backfill).
router.get('/audit/verify-all', async (req, res) => {
  try {
    const CAP = 1000;
    const lands = await Land.find({}).select('khasraNo village').sort({ village: 1, khasraNo: 1 }).limit(CAP + 1).lean();
    const truncated = lands.length > CAP;

    const results = [];
    for (const l of lands.slice(0, CAP)) {
      const v = await audit.verifyLand(l._id);
      results.push({
        id: l._id, khasraNo: l.khasraNo, village: l.village,
        state: v.state, blocks: v.blocks, issueCount: v.issues.length + (v.brokenAt ? 1 : 0),
      });
    }
    const order = { tampered: 0, not_anchored: 1, intact: 2 };
    results.sort((a, b) => order[a.state] - order[b.state]);

    const summary = { total: results.length, intact: 0, tampered: 0, not_anchored: 0 };
    for (const r of results) summary[r.state] += 1;
    res.json({ summary, truncated, results, checkedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
