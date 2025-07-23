// Invoice.js
const mongoose = require('mongoose');

// Schema for notes associated with an invoice
const noteSchema = new mongoose.Schema({
  text: String,
  timestamp: String,
  author: String
}, { _id: false }); // _id: false prevents Mongoose from creating a default _id for subdocuments

// Schema for payment history entries
const paymentSchema = new mongoose.Schema({
  amount: Number,
  date: String,
  method: String,
  reference: String,
  addedBy: String
}, { _id: false });

// Schema for follow-up entries
const followUpSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  note: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to a User model
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Define the item schema separately to include productId and productName
const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // Reference to Product model
  productName: String, // Product name for display
  description: String,
  hsnSac: String,
  quantity: Number,
  rate: Number,
  specifications: [{ name: String, value: String }] // Array of specification objects
}, { _id: false });

// Main Invoice Schema
const invoiceSchema = new mongoose.Schema({
  // Unique invoice number, sparse allows null values but ensures uniqueness for non-null
  invoiceNumber: { type: String, unique: true, sparse: true },

  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAccount' }, // Reference to BusinessAccount model
  businessName: String,             // Denormalized for display and easier access
  customerName: String,
  customerAddress: String,
  customerGSTIN: String,
  companyGSTIN: String,
  companyName: String,
  companyAddress: String,
  contactPerson: String,
  contactNumber: String,
  
  // NEW FIELDS: Added contactName, email, mobileNumber for the customer/business contact
  contactName: { type: String, required: true },
  email: { type: String, required: true },
  mobileNumber: { type: String, required: true },

  date: String, // Date of invoice creation
  dueDate: String, // Due date for payment

  items: [itemSchema], // Array of items using the defined itemSchema

  subTotal: Number,
  tax: Number,
  taxRate: { type: Number, default: 18 }, // Default GST rate
  totalAmount: Number,
  discountAmount: { type: Number, default: 0 },

  gstType: { type: String, enum: ['intrastate', 'interstate'], default: 'intrastate' },
  gstPercentage: { type: Number, default: 18 }, // Custom entry for GST percentage
  cgstAmount: Number, // Central GST amount
  sgstAmount: Number, // State GST amount
  igstAmount: Number, // Integrated GST amount

  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  paymentHistory: [paymentSchema], // Array of payment entries

  invoiceType: {
    type: String,
    enum: ['Invoice'], // Only 'Invoice' type is supported now
    default: 'Invoice'
  },
  
  notes: [noteSchema], // Array of notes
  paymentTerms: String,
  
  // isClosed field to indicate if the invoice is locked/closed
  isClosed: { type: Boolean, default: false }, 
  
  followUps: [followUpSchema] // Array of follow-up entries

}, { timestamps: true }); // timestamps: true adds createdAt and updatedAt fields automatically

module.exports = mongoose.model('Invoice', invoiceSchema);
