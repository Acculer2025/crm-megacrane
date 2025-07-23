const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

    
router.get('/', userController.getAllUsers);           // Get all users
router.get('/:id', userController.getSingleUser);    // Get a single user by ID (NEW)
router.post('/', userController.createUser);         // Create a new user
router.put('/:id', userController.updateUser);       // Update an existing user
router.delete('/:id', userController.deleteUser);    // Delete a user
router.put('/transfer/:id', userController.transferUserTeam);
module.exports = router;
