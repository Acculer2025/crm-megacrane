// productController.js
const Product = require('../models/Product'); // Assuming your Product Mongoose model is here
const { v4: uuidv4 } = require('uuid'); //Import uuid

// GET all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("Error fetching all products:", err);
    res.status(500).json({ error: 'Failed to fetch products. Please try again later.' });
  }
};

// GET one product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(product);
  } catch (err) {
    console.error("Error fetching product by ID:", err);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
};

// POST create a new product
exports.createProduct = async (req, res) => {
  try {
    // Generate a unique product_id before creating the product
    const newProductId = uuidv4(); //
    const newProduct = new Product({
      ...req.body,
      product_id: newProductId //Assign the generated ID
    });
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(400).json({ error: 'Failed to create product. Please check your input.' });
  }
};

// PUT update a product
exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(updatedProduct);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(400).json({ error: 'Failed to update product. Please check your input.' });
  }
};

// DELETE a product
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ message: "Product deleted successfully." });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(400).json({ error: 'Failed to delete product.' });
  }
};

// PUT update product notes
exports.updateProductNotes = async (req, res) => {
  try {
    const { notes } = req.body; // Assuming notes are sent in the request body
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { notes: notes }, // Update only the notes field
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(updatedProduct);
  } catch (err) {
    console.error("Error updating product notes:", err);
    res.status(400).json({ error: 'Failed to update product notes.' });
  }
};