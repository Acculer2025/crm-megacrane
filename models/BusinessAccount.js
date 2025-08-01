// File: BusinessAccount.js

const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    text: String,
    timestamp: String,
    author: String
}, { _id: false });

const followUpSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    note: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const contactPersonSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String },
    phoneNumber: { type: String },
}, { _id: true });

const businessAccountSchema = new mongoose.Schema({
    businessName: { type: String, required: true, unique: true },
    contactName: { type: String, required: true },
    contactEmail: { type: String },
    contactNumber: { type: String, required: true },
    address: { type: String },
    sourceType: { type: String, default: 'Direct' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['Active', 'Pipeline', 'Quotations', 'Customer', 'Closed', 'TargetLeads'],
        default: 'Active'
    },
    notes: [noteSchema],
    followUps: [followUpSchema],
    selectedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    totalPrice: { type: Number, default: 0 },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    contactPerson: { type: String },
    typeOfLead: [{
        type: String,
        enum: ['Regular', 'Government', 'Occupational']
    }],
    gstNumber: String,
    
    quotations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' }]
});

businessAccountSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('BusinessAccount', businessAccountSchema);