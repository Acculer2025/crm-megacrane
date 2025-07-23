// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  mobile: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true // Password should be required for new users
  },
  role: {
    type: String,
    enum: ['Superadmin', 'Admin', 'Team Leader', 'Employee'], // Added 'Team Leader' role
    default: 'Employee'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  department: { // NEW: Reference to Department
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  team: { // NEW: Reference to Team (crucial for tracking user's team assignment)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  }
}, { timestamps: true });

// You might want to add pre-save hooks for password hashing here if not already present.
// For simplicity, it's omitted in this update but highly recommended for production.

module.exports = mongoose.model('User', userSchema);