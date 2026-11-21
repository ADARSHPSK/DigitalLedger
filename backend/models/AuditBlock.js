const mongoose = require('mongoose');

// ── AuditBlock ────────────────────────────────────────────────────────────────
// One block in a plot's hash-chained audit log (paper §III-H, Algorithm 2).
//
//   block N:  hash = SHA256( content | timestamp | prevHash )
//   block N+1 stores prevHash = hash of block N
//
// Changing ANY earlier block changes its hash, which no longer matches the
// prevHash stored in the next block — so tampering is detectable.
//
// The log is a separate collection from Land, so a change made directly to a
// Land document does not automatically "fix" the audit log.
const auditBlockSchema = new mongoose.Schema({
  land: { type: mongoose.Schema.Types.ObjectId, ref: 'Land', required: true },

  // Position in this plot's chain: 0, 1, 2, ...
  seq: { type: Number, required: true },

  // What kind of write this block records
  //   ownership → an entry was appended to Land.ownershipHistory
  //   comment   → an entry was appended to Land.officialComments (may carry a status tag)
  //   status    → status changed WITHOUT a comment (PATCH /land/:id/status, or a backfill baseline)
  type: { type: String, enum: ['ownership', 'comment', 'status'], required: true },

  // _id of the ownership / comment subdocument this block covers (null for 'status')
  entryId: { type: mongoose.Schema.Types.ObjectId, default: null },

  // Canonical (deterministic) JSON text of the entry — see services/auditChain.js
  content: { type: String, required: true },

  // Server time the block was written
  timestamp: { type: Date, required: true },

  prevHash: { type: String, required: true },   // hash of the previous block (or GENESIS)
  hash: { type: String, required: true },       // SHA-256 hex of this block
});

// A plot can never have two blocks at the same position. This also makes
// concurrent appends safe: the second writer gets a duplicate-key error and retries.
auditBlockSchema.index({ land: 1, seq: 1 }, { unique: true });

// ── Append-only guard (application level) ─────────────────────────────────────
// No code path in this app updates or deletes a block. These hooks make an
// accidental attempt fail loudly. (Direct database access can still bypass them —
// that is exactly the case VerifyChain exists to detect.)
const blocked = [
  'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndDelete',
];
auditBlockSchema.pre(blocked, function () {
  throw new Error('AuditBlock is append-only: updates and deletes are not allowed.');
});
auditBlockSchema.pre('save', function () {
  if (!this.isNew) throw new Error('AuditBlock is append-only: existing blocks cannot be modified.');
});

module.exports = mongoose.model('AuditBlock', auditBlockSchema);
