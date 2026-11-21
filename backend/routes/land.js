const router = require('express').Router();
const mongoose = require('mongoose');
const Land = require('../models/Land');
const UserModel = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { perUserLimit } = require('../middleware/rateLimit');
const audit = require('../services/auditChain');
const { summariseLand, SummaryError } = require('../services/summariser');

// ── Helpers for the audit chain / access rules ────────────────────────────────

// Officials may only WRITE to plots in their assigned villages (paper Algorithm 1,
// precondition). Admins are unrestricted. An official with no villages can write nowhere.
// Returns null when allowed, or { status, message } when not.
async function officialMayWrite(req, landId) {
  const land = await Land.findById(landId).select('village');
  if (!land) return { status: 404, message: 'Land not found.' };
  if (req.user.role === 'admin') return null;
  const user = await UserModel.findById(req.user.id).select('assignedVillages');
  if (!user || !(user.assignedVillages || []).includes(land.village)) {
    return { status: 403, message: 'This plot is outside your assigned villages.' };
  }
  return null;
}

// Same rule GET /:id uses: an owner only gets full detail of plots linked to them.
// Officials and admins always may. (Summaries and integrity reports follow this rule
// so they can never reveal more than the detail screen does.)
async function mayReadFull(req, land) {
  if (req.user.role !== 'owner') return true;
  const user = await UserModel.findById(req.user.id).select('landRefs');
  return !!user && user.landRefs.some(
    r => String(r.khasraNo) === String(land.khasraNo) && String(r.village) === String(land.village)
  );
}

// If the audit block could not be written, still return the saved record but flag it.
function withAuditFlag(land, anchored) {
  return anchored ? land : { ...land.toObject(), auditWarning: true };
}

// ── GET /land/search ──────────────────────────────────────────────────────────
// Search by village, khasra number, or owner name
// Example: GET /land/search?q=rampur   or   GET /land/search?status=disputed
// No login required — public search
router.get('/search', async (req, res) => {
  try {
    const { q, status, village } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (village) filter.village = new RegExp(village, 'i'); // case-insensitive

    if (q) {
      // $or means: match if ANY of these conditions is true
      filter.$or = [
        { khasraNo: new RegExp(q, 'i') },
        { currentOwner: new RegExp(q, 'i') },
        { village: new RegExp(q, 'i') },
      ];
    }

    const lands = await Land.find(filter)
      .select('khasraNo village currentOwner areaValue areaUnit landType status updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json(lands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /land/my/lands ────────────────────────────────────────────────────────
// Returns all land plots linked to the logged-in owner's account
// Must be logged in (protect)
// NOTE: this route must come BEFORE  /:id  otherwise "my" gets treated as an id
router.get('/my/lands', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    // Build a list of { khasraNo, village } pairs from the user's landRefs
    const conditions = user.landRefs.map(r => ({
      khasraNo: r.khasraNo,
      village: r.village,
    }));

    if (!conditions.length) return res.json([]);

    const lands = await Land.find({ $or: conditions })
      .select('khasraNo village currentOwner areaValue areaUnit landType status updatedAt');

    res.json(lands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /land/official/flagged ────────────────────────────────────────────────
// Officials see all disputed / under-review lands in their assigned villages
// Must be logged in AND be an official or admin
// NOTE: also must come BEFORE /:id
router.get('/official/flagged', protect, requireRole('official', 'admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    const filter = { status: { $in: ['disputed', 'under_review'] } };

    // Limit officials to only their assigned villages
    if (req.user.role === 'official' && user.assignedVillages?.length) {
      filter.village = { $in: user.assignedVillages };
    }

    const lands = await Land.find(filter)
      .select('khasraNo village currentOwner areaValue areaUnit status officialComments updatedAt')
      .sort({ updatedAt: -1 });

    res.json(lands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /land/:id ─────────────────────────────────────────────────────────────
// Full detail for one land plot
// Owners can see basic details of ANY land, but history/comments are stripped if they don't own it
router.get('/:id', protect, async (req, res) => {
  try {
    // Lean() gives us a plain JS object we can modify before sending
    const landDoc = await Land.findById(req.params.id)
      .populate('officialComments.officialId', 'name designation')
      .lean();

    if (!landDoc) return res.status(404).json({ message: 'Land record not found.' });

    // Enforce RBAC for owners viewing land
    if (req.user.role === 'owner') {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      
      const ownsLand = user.landRefs.some(
        r => String(r.khasraNo) === String(landDoc.khasraNo) && String(r.village) === String(landDoc.village)
      );

      // If they don't own it, strip sensitive history and comments
      // (They can still view the public details)
      if (!ownsLand) {
        landDoc.ownershipHistory = [];
        landDoc.officialComments = [];
        landDoc._isRestricted = true; // Flag for frontend UI
      }
    }

    res.json(landDoc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /land ────────────────────────────────────────────────────────────────
// Create a brand new land record — admin only
// This is how you first add a plot to the system
router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const {
      khasraNo, village, tehsil, district,
      areaValue, areaUnit, landType,
      currentOwner, firstOwnerDate, documentRef, recordedBy, notes,
    } = req.body;

    const land = await Land.create({
      khasraNo, village, tehsil, district,
      areaValue, areaUnit, landType,
      currentOwner,
      // The first entry in the ownership history is always 'original'
      ownershipHistory: [{
        ownerName: currentOwner,
        transferType: 'original',
        date: firstOwnerDate || new Date(),
        documentRef,
        recordedBy,
        notes,
      }],
    });

    // Start this plot's audit chain with its 'original' ownership entry
    const anchored = await audit.safeAnchor(() => audit.anchorOwnership(land, land.ownershipHistory[0]._id));
    res.status(201).json(withAuditFlag(land, anchored));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /land/:id/transfer ───────────────────────────────────────────────────
// Record a new ownership transfer — appends to history, never deletes old entries
// official or admin only
router.post('/:id/transfer', protect, requireRole('official', 'admin'), async (req, res) => {
  try {
    const { ownerName, transferType, date, documentRef, notes } = req.body;

    const denied = await officialMayWrite(req, req.params.id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const entryId = new mongoose.Types.ObjectId();   // known up-front so the audit block can reference it

    const out = await audit.withLandLock(req.params.id, async () => {
      const land = await Land.findByIdAndUpdate(
        req.params.id,
        {
          $set: { currentOwner: ownerName },   // update quick-access field
          $push: {                               // $push APPENDS — never overwrites
            ownershipHistory: {
              _id: entryId,
              ownerName,
              transferType,
              date,
              documentRef,
              recordedBy: req.user.name,         // who logged this transfer
              notes,
            },
          },
        },
        { returnDocument: 'after', runValidators: true }  // runValidators: reject transferType outside the enum
      );
      if (!land) return null;
      const anchored = await audit.safeAnchor(() => audit.anchorOwnership(land, entryId));
      return withAuditFlag(land, anchored);
    });

    if (!out) return res.status(404).json({ message: 'Land not found.' });
    res.json(out);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── POST /land/:id/comment ────────────────────────────────────────────────────
// Official adds a comment + optionally tags the land's status
// official or admin only
router.post('/:id/comment', protect, requireRole('official', 'admin'), async (req, res) => {
  try {
    const { text, tag } = req.body;
    // tag is optional — e.g. "disputed", "clear", "under_review"

    const denied = await officialMayWrite(req, req.params.id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const entryId = new mongoose.Types.ObjectId();

    const update = {
      $push: {
        officialComments: {
          _id: entryId,
          officialId: req.user.id,
          officialName: req.user.name,
          text,
          tag: tag || undefined,
          createdAt: new Date(),
        },
      },
    };

    // If a tag was sent, also update the top-level land status
    if (tag) update.$set = { status: tag };

    // Comment + status change are ONE atomic update; the audit block follows under the plot lock.
    const out = await audit.withLandLock(req.params.id, async () => {
      const land = await Land.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true });
      if (!land) return null;
      const anchored = await audit.safeAnchor(() => audit.anchorComment(land, entryId));
      return withAuditFlag(land, anchored);
    });

    if (!out) return res.status(404).json({ message: 'Land not found.' });
    res.json(out);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /land/:id/status ────────────────────────────────────────────────────
// Quickly change land status without writing a full comment
// official or admin only
router.patch('/:id/status', protect, requireRole('official', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['clear', 'under_review', 'disputed'];

    if (!valid.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${valid.join(', ')}` });
    }

    const denied = await officialMayWrite(req, req.params.id);
    if (denied) return res.status(denied.status).json({ message: denied.message });

    const out = await audit.withLandLock(req.params.id, async () => {
      // new:false → we get the document as it was BEFORE the change, so we know the old status
      const before = await Land.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'before', runValidators: true });
      if (!before) return null;
      let anchored = true;
      if (before.status !== status) {   // a no-op change has nothing to record
        anchored = await audit.safeAnchor(() => audit.anchorStatus(before._id, {
          from: before.status, to: status, byId: req.user.id, byName: req.user.name,
        }));
      }
      return anchored ? { status } : { status, auditWarning: true };
    });

    if (!out) return res.status(404).json({ message: 'Land not found.' });
    res.json(out);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /land/:id/integrity ───────────────────────────────────────────────────
// Runs VerifyChain for one plot (paper §III-H). Same access rule as the detail screen.
// state: 'intact' | 'tampered' | 'not_anchored'
router.get('/:id/integrity', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Land record not found.' });
    const land = await Land.findById(req.params.id).select('khasraNo village');
    if (!land) return res.status(404).json({ message: 'Land record not found.' });
    if (!(await mayReadFull(req, land))) return res.status(403).json({ message: 'You do not have permission for this record.' });

    res.json(await audit.verifyLand(req.params.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /land/:id/summarise ──────────────────────────────────────────────────
// AI-assisted plain-language summary (paper §III-G). Never changes any data.
// Owners get everyday language, officials a concise briefing (role-aware prompt).
router.post('/:id/summarise', protect,
  perUserLimit('summary', () => Number(process.env.SUMMARY_LIMIT_PER_HOUR) || 20),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Land record not found.' });
      const land = await Land.findById(req.params.id).lean();
      if (!land) return res.status(404).json({ message: 'Land record not found.' });
      if (!(await mayReadFull(req, land))) return res.status(403).json({ message: 'You do not have permission for this record.' });

      const audience = req.user.role === 'owner' ? 'owner' : 'official';
      const { summary, model } = await summariseLand({ land, audience });
      res.json({ summary, model, generatedAt: new Date().toISOString() });
    } catch (err) {
      if (err instanceof SummaryError) {
        if (err.code === 'not_configured') {
          return res.status(503).json({ code: 'not_configured', message: 'AI summary is not available on this server.' });
        }
        console.error('[summary] upstream failure:', err.message);   // detail stays in the server log
        return res.status(503).json({ code: 'unavailable', message: 'The summary service is unavailable right now. You can still read the full record.' });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;