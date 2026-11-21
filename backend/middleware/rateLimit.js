// ── perUserLimit ──────────────────────────────────────────────────────────────
// Minimal in-memory limiter keyed by the logged-in user's id. Use AFTER protect().
// Meant to stop one account from running up the AI bill; fine for a single-server
// pilot. Several server instances would each keep their own counters (use Redis then).
//
//   router.post('/:id/summarise', protect, perUserLimit('summary', () => limit), handler)
const buckets = new Map();

function perUserLimit(name, getMax, windowMs = 60 * 60 * 1000) {
  return (req, res, next) => {
    const now = Date.now();
    const max = getMax();
    const key = `${name}:${req.user.id}`;

    if (buckets.size > 5000) {                        // occasional cleanup
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }

    let b = buckets.get(key);
    if (!b || b.resetAt <= now) b = { count: 0, resetAt: now + windowMs };
    b.count += 1;
    buckets.set(key, b);

    if (b.count > max) {
      const mins = Math.max(1, Math.ceil((b.resetAt - now) / 60000));
      res.set('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ message: `Too many requests. Please try again in about ${mins} minute(s).` });
    }
    next();
  };
}

module.exports = { perUserLimit };
