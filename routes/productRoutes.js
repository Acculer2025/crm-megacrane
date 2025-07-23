const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Get all products
router.get('/product', productController.getAllProducts);

// Get one product by ID
router.get('/product/:id', productController.getProductById);

// Create a new product
router.post('/product', productController.createProduct);

// Update a product
router.put('/product/:id', productController.updateProduct);

// Delete a product
router.delete('/product/:id', productController.deleteProduct);

// Update product notes
router.put('/product/:id/notes', productController.updateProductNotes);

module.exports = router;
