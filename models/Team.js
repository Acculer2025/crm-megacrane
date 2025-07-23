// models/Team.js
const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: false,
   
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  teamLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true, // A team leader can only lead one team
    sparse: true // Allows null values but enforces uniqueness for non-null values
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);