const mongoose = require('mongoose');

// ── Sub-schema 1: one ownership transfer event ────────────────────────────────
// Every time land changes hands, one of these gets pushed into ownershipHistory[]
const ownershipEventSchema = new mongoose.Schema({
  ownerName: { type: String, required: true },
  ownerContact: { type: String },
  transferType: {
    type: String,
    // only these values are allowed
    enum: ['original', 'sale', 'inheritance', 'gift', 'court_order', 'govt_allotment'],
    required: true,
  },
  documentRef: { type: String },   // deed number / patta number
  recordedBy: { type: String },   // name of patwari who recorded it
  date: { type: Date, required: true },
  notes: { type: String },
}, { _id: true });

// ── Sub-schema 2: one official comment ───────────────────────────────────────
// Officials (patwari, revenue inspector) add these to flag issues
const officialCommentSchema = new mongoose.Schema({
  officialId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  officialName: { type: String, required: true },
  role: { type: String },   // "Patwari", "Revenue Inspector", etc.
  text: { type: String, required: true },
  tag: { type: String, enum: ['clear', 'under_review', 'disputed'] },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

// ── Main Land schema ──────────────────────────────────────────────────────────
const landSchema = new mongoose.Schema({

  // Identity
  khasraNo: { type: String, required: true },   // official plot number
  village: { type: String, required: true },
  tehsil: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, default: 'Uttar Pradesh' },

  // Physical details
  areaValue: { type: Number, required: true },
  areaUnit: { type: String, enum: ['bigha', 'hectare', 'acre'], default: 'bigha' },
  landType: { type: String, enum: ['agricultural', 'residential', 'commercial', 'govt'], required: true },

  // Current status
  status: {
    type: String,
    enum: ['clear', 'under_review', 'disputed'],
    default: 'clear',
  },

  // Quick-access current owner (always matches the last entry in ownershipHistory)
  currentOwner: { type: String, required: true },

  // THE LEDGER — full chain of ownership, never deleted
  ownershipHistory: [ownershipEventSchema],

  // Official comments and tags
  officialComments: [officialCommentSchema],

  // Extra searchable tags e.g. ["encroachment", "boundary-issue"]
  tags: [String],

}, { timestamps: true });  // auto-adds createdAt and updatedAt fields

// Indexes make queries fast
landSchema.index({ village: 1, khasraNo: 1 }, { unique: true }); // no duplicate plots
landSchema.index({ currentOwner: 1 });
landSchema.index({ status: 1 });

module.exports = mongoose.model('Land', landSchema);