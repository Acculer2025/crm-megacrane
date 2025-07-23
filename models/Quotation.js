// Quotation.js
const mongoose = require('mongoose');

const specificationSchema = new mongoose.Schema({
  name: String,
  value: String
}, { _id: false });

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  description: String,
  hsnSac: String,
  quantity: Number,
  quantityType: String,
  rate: Number,
  specifications: [specificationSchema],
  gstPercentage: { type: Number, default: 18 }
}, { _id: false });

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

const gstDetailsSchema = new mongoose.Schema({
  sgst: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  calculatedTotalGst: { type: Number, default: 0 },
  manualGstAmount: { type: Number, default: null },
  manualSgstPercentage: { type: Number, default: null },
  manualCgstPercentage: { type: Number, default: null },
  // manualIgstPercentage: { type: Number, default: null }, // Assuming you might add this later based on previous discussions
  finalTaxAmountUsed: { type: Number, default: 0 }
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAccount', required: true },
  businessName: String,
  businessType: String,
  businessInfo: String,
  gstin: String,
  followUps: [followUpSchema],

  quotationNumber: { type: String, unique: true, required: true },
  date: String,
  validUntil: String,
  mobileNumber: { type: String },

  // --- CORRECTED SYNTAX FOR DEFAULT NULL VALUES ---
  customerName: { type: String, default: null },
  customerEmail: { type: String, default: null },
  customerAddress: String, // Keep as is if no default is needed or if it's derived

  items: [itemSchema],
  subTotal: Number,
  tax: Number,
  total: Number,
  createdDate: String,
  notes: [noteSchema],
  pdfUrl: String,
  gstType: String,
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Approved', 'Rejected'],
    default: 'Draft'
  },

  delivery: { type: String, default: null },
  warranty: { type: String, default: null },
  quotationNotes: { type: String, default: null },
  paymentTerms: { type: String, default: null },
  pricesTerms: { type: String, default: null },
  ourPaymentTerms: { type: String, default: null },
  packingForwardingCharges: { type: String, default: null },
  transportationCharges: { type: String, default: null },
  transporterName: { type: String, default: null },
  modePlaceDelivery: { type: String, default: null },
  offerValidity: { type: String, default: null },
  customerScope: { type: String, default: null },
  // --- END CORRECTED SYNTAX ---

  gstDetails: gstDetailsSchema
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);