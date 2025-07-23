// BusinessAccount.js
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

const businessAccountSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  sourceType: {
    type: String,
    enum: ['Direct', 'socialmedia', 'online',  'client','tradefair', 'Other'],
    default: 'Other'
  },
  gstNumber: { type: String, required: false },
  contactName: { type: String, required: true },
  email: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  phoneNumber: String,
  followUps: [followUpSchema],
  addressLine1: { type: String, required: true },
  addressLine2: String,
  addressLine3: String,
  landmark: String,
  city: { type: String, required: true },
  pincode: { type: Number, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  website: String,
  type: { type: String, enum: ['Hot', 'Warm', 'Cold'], required: true },
  notes: [noteSchema],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['Active', 'Inactive', 'Pipeline', 'Closed', 'Customer','Quotations'], default: 'Active' },
  isCustomer: { type: Boolean, default: false }, // Indicates if the account is a customer
  selectedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // NEW: Reference to Product
}, { timestamps: true });

module.exports = mongoose.model('BusinessAccount', businessAccountSchema);