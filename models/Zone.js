// models/Zone.js
const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Ensures zone names are unique
        trim: true,
    },
}, { timestamps: true });

const Zone = mongoose.model('Zone', zoneSchema);

module.exports = Zone;