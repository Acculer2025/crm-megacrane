const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: String,
  timestamp: String,
  author: String
}, { _id: false });

const optionSchema = new mongoose.Schema({
  type: { type: String, required: false },
  description: { type: String, required: false },
}, { _id: false });

const productSchema = new mongoose.Schema({
  product_id: { type: String, required: true, unique: true },
  productName: { type: String, required: true },
  price: Number,
  quantity: Number,
  inStock: Number,
  outStock: Number,
  stockLoadDate: Date,
  isActive: { type: Boolean, default: true },
  description: String,
  options: [optionSchema],
  notes: [noteSchema],
  hsnSac: String // Added the HSN/SAC field here
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);