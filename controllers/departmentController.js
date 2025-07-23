const Department = require('../models/Department');

// Create Department
exports.createDepartment = async (req, res) => {
  try {
    const newDepartment = await Department.create(req.body);
    res.status(201).json(newDepartment);
  } catch (err) {
    if (err.code === 11000) { // Duplicate key error
      return res.status(400).json({ message: 'Department with this name already exists.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Get All Departments
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Single Department
exports.getSingleDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json(department);
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Department ID format' });
    }
    res.status(500).json({ error: err.message });
  }
};

// Update Department
exports.updateDepartment = async (req, res) => {
  try {
    const updatedDepartment = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDepartment) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json(updatedDepartment);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Department with this name already exists.' });
    }
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Department ID format' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Delete Department
exports.deleteDepartment = async (req, res) => {
  try {
    // Before deleting, check if any teams or users are associated with this department
    const Team = require('../models/Team'); // Require here to avoid circular dependency
    const User = require('../models/User'); // Require here to avoid circular dependency

    const associatedTeams = await Team.countDocuments({ department: req.params.id });
    if (associatedTeams > 0) {
      return res.status(400).json({ message: 'Cannot delete department: associated with one or more teams.' });
    }

    const associatedUsers = await User.countDocuments({ department: req.params.id });
    if (associatedUsers > 0) {
      return res.status(400).json({ message: 'Cannot delete department: associated with one or more users.' });
    }

    const deletedDepartment = await Department.findByIdAndDelete(req.params.id);
    if (!deletedDepartment) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Department ID format' });
    }
    res.status(400).json({ error: err.message });
  }
};