const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper function — creates a JWT token that lasts 30 days
// The token carries the user's id, role, and name
function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// ── POST /auth/register ───────────────────────────────────────────────────────
// Creates a new account
// Request body: { name, phone, password, role }
// role defaults to 'owner' if not provided
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // Role is ALWAYS 'owner' for self-registration.
    // Officials and admins are created only via seed script or direct DB access.
    const role = 'owner';

    // Check if phone number already used
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: 'Phone already registered.' });
    }

    // Create user — password gets hashed automatically by the model's pre-save hook
    const user = await User.create({ name, phone, password, role });
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
// Logs in with phone + password, returns a token
// Request body: { phone, password }
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Phone or password incorrect.' });
    }

    // Check password against the stored hash
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Phone or password incorrect.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;