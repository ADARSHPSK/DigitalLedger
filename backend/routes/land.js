const router = require('express').Router();
const Land = require('../models/Land');
const { protect, requireRole } = require('../middleware/auth');

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
// Full detail for one land plot — includes complete ownership history + comments
// Must be logged in
router.get('/:id', protect, async (req, res) => {
  try {
    const land = await Land.findById(req.params.id)
      .populate('officialComments.officialId', 'name designation');
    // populate replaces the officialId (just an ID) with the actual name + designation

    if (!land) return res.status(404).json({ message: 'Land record not found.' });

    // Owners can only view their own land — check landRefs
    if (req.user.role === 'owner') {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      const canView = user.landRefs.some(
        r => r.khasraNo === land.khasraNo && r.village === land.village
      );
      if (!canView) return res.status(403).json({ message: 'Access denied.' });
    }

    res.json(land);
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

    res.status(201).json(land);
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

    const land = await Land.findByIdAndUpdate(
      req.params.id,
      {
        $set: { currentOwner: ownerName },   // update quick-access field
        $push: {                               // $push APPENDS — never overwrites
          ownershipHistory: {
            ownerName,
            transferType,
            date,
            documentRef,
            recordedBy: req.user.name,         // who logged this transfer
            notes,
          },
        },
      },
      { new: true }  // return the updated document
    );

    if (!land) return res.status(404).json({ message: 'Land not found.' });
    res.json(land);
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

    const update = {
      $push: {
        officialComments: {
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

    const land = await Land.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!land) return res.status(404).json({ message: 'Land not found.' });

    res.json(land);
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

    const land = await Land.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!land) return res.status(404).json({ message: 'Land not found.' });
    res.json({ status: land.status });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;