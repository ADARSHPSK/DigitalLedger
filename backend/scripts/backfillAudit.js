/**
 * Start audit chains for plots that were created BEFORE the audit log existed.
 *
 *   npm run audit:backfill
 *
 * - Only touches plots that have NO blocks yet; plots with a chain are never modified,
 *   so this cannot "re-approve" a tampered plot.
 * - The new blocks describe the plot AS IT IS RIGHT NOW. Run it once, right after upgrading,
 *   on data you trust.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Land = require('../models/Land');
const AuditBlock = require('../models/AuditBlock');
const { backfillLand } = require('../services/auditChain');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const anchored = new Set((await AuditBlock.distinct('land')).map(String));
  const lands = await Land.find({}).select('_id khasraNo village').lean();
  const todo = lands.filter(l => !anchored.has(String(l._id)));

  console.log(`${lands.length} plots, ${anchored.size} already have a chain, ${todo.length} to anchor.`);
  let blocks = 0;
  for (const l of todo) {
    const r = await backfillLand(l._id);
    blocks += r.blocks || 0;
    console.log(`  anchored ${l.khasraNo} (${l.village}): ${r.blocks || 0} blocks`);
  }
  console.log(`Done. ${blocks} blocks written.`);
  await mongoose.disconnect();
})().catch(e => { console.error('Backfill failed:', e.message); process.exit(1); });
