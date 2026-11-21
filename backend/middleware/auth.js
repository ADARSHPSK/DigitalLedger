const jwt = require('jsonwebtoken');

// ── protect ───────────────────────────────────────────────────────────────────
// Add this to any route that requires login.
// It reads the token from the request header, verifies it,
// and puts the user info into req.user so the route handler can use it.
//
// How the token gets sent from the app:
//   headers: { Authorization: "Bearer eyJhbGc..." }
//
function protect(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token — please log in.' });
  }

  const token = header.split(' ')[1]; // get the part after "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;  // now every route below can use req.user.id, req.user.role
    next();              // move on to the actual route handler
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired.' });
  }
}

// ── requireRole ───────────────────────────────────────────────────────────────
// Use AFTER protect() to restrict a route to specific roles.
//
// Example usage in a route file:
//   router.post('/:id/comment', protect, requireRole('official', 'admin'), handler)
//
// This means: must be logged in AND must be official or admin
//
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action.' });
    }
    next();
  };
}

module.exports = { protect, requireRole };