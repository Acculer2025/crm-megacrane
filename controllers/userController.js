// controllers/userController.js
const User = require('../models/User');
const Team = require('../models/Team');
const Department = require('../models/Department');
const Zone = require('../models/Zone');

// Helper function to update a user's team, department, and zone fields
const updateUserTeamAndDepartmentAndZone = async (userId, teamId = null, departmentId = null, newZoneId = null) => {
    if (!userId) return;
    try {
        const update = {};
        update.team = teamId;
        update.department = departmentId;
        update.zone = newZoneId;
        await User.findByIdAndUpdate(userId, update, { new: true });
    } catch (error) {
        console.error(`Error updating user ${userId}:`, error.message);
    }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (e.g., Admin)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .populate('department', 'name')
            .populate('team', 'name')
            .populate('zone', 'name') // Populate zone name
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// @desc    Get a single user by ID
// @route   GET /api/users/:id
// @access  Private
exports.getSingleUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('department', 'name')
            .populate('team', 'name')
            .populate('zone', 'name'); // Populate zone name
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid User ID format' });
        }
        res.status(500).json({ error: err.message });
    }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Private (e.g., Admin)
exports.createUser = async (req, res) => {
    try {
        const newUser = await User.create(req.body);
        res.status(201).json(newUser);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }
        res.status(400).json({ error: err.message });
    }
};

// @desc    Update an existing user
// @route   PUT /api/users/:id
// @access  Private (e.g., Admin)
exports.updateUser = async (req, res) => {
    try {
        const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(updated);
    } catch (err) {
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid User ID format' });
        }
        res.status(400).json({ error: err.message });
    }
};

// @desc    Get users by zone
// @route   GET /api/users/zone/:zoneId
// @access  Private
exports.getUsersByZone = async (req, res) => {
    try {
        const { zoneId } = req.params;
        const users = await User.find({ zone: zoneId })
            .populate('zone', 'name')
            .select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users by zone', error: error.message });
    }
};
// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private (e.g., Admin)
exports.deleteUser = async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted' });
    } catch (err) {
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid User ID format' });
        }
        res.status(400).json({ error: err.message });
    }
};

// @desc    Transfer a user to a new team, department, and zone
// @route   PUT /api/users/transfer/:id
// @access  Private (e.g., Admin)
exports.transferUser = async (req, res) => {
    try {
        const { id: userId } = req.params;
        const { newDepartmentId, newTeamId, newZoneId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const originalTeamId = user.team ? user.team.toString() : null;
        
        // 1. Unassign from original team if applicable
        if (originalTeamId && originalTeamId !== newTeamId) {
            const originalTeam = await Team.findById(originalTeamId);
            if (originalTeam) {
                originalTeam.members = originalTeam.members.filter(memberId => memberId.toString() !== userId);
                if (originalTeam.teamLeader && originalTeam.teamLeader.toString() === userId) {
                    originalTeam.teamLeader = null;
                }
                await originalTeam.save();
            }
        }

        // 2. Assign to new team if provided
        let resolvedDepartmentId = newDepartmentId || null;
        if (newTeamId) {
            const newTeam = await Team.findById(newTeamId);
            if (!newTeam) {
                return res.status(400).json({ message: 'New team not found.' });
            }
            resolvedDepartmentId = newTeam.department;
            if (!newTeam.members.includes(userId)) {
                newTeam.members.push(userId);
            }
            if (user.role === 'Team Leader' && !newTeam.teamLeader) {
                newTeam.teamLeader = userId;
            }
            await newTeam.save();
        }
        
        // 3. Update the user's document with all new values, including the zone ObjectId
        await updateUserTeamAndDepartmentAndZone(userId, newTeamId, resolvedDepartmentId, newZoneId);

        const updatedUser = await User.findById(userId)
            .populate('team', 'name')
            .populate('department', 'name')
            .populate('zone', 'name');

        res.json({ message: 'User transferred successfully', user: updatedUser });

    } catch (err) {
        console.error("Transfer error:", err);
        res.status(500).json({ error: err.message });
    }
};