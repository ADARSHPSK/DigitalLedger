const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // used as login ID
  password: { type: String, required: true },

  // Three roles:
  // 'owner'    → villager, can only see their own land records
  // 'official' → patwari / revenue inspector, can comment and tag any land
  // 'admin'    → can create new land records
  role: {
    type: String,
    enum: ['owner', 'official', 'admin'],
    default: 'owner',
  },

  // Officials only — which villages they have jurisdiction over
  assignedVillages: [String],
  designation: { type: String },   // e.g. "Patwari", "Revenue Inspector"

  // Owners only — which land plots are linked to this account
  // Stored as khasraNo + village pairs so admin can link them
  landRefs: [{
    khasraNo: String,
    village: String,
  }],

}, { timestamps: true });

// BEFORE saving a user, hash the password automatically
// This runs every time .save() is called on a User
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Method to check a login attempt — returns true or false
userSchema.methods.comparePassword = function (plainTextPassword) {
  return bcrypt.compare(plainTextPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);