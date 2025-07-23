const User = require('../models/User');
const Team = require('../models/Team'); // Added for transfer functionality
const Department = require('../models/Department'); // Added for transfer functionality

// Helper to update user's team and department fields
// This function is critical for ensuring a user's 'team' and 'department' fields are correctly set or unset.
const updateUserTeamAndDepartment = async (userId, teamId = null, departmentId = null) => {
  if (!userId) return; // Ensure userId is valid
  try {
    const update = {};
    update.team = teamId; // Directly assign teamId (can be null)
    update.department = departmentId; // Directly assign departmentId (can be null)

    await User.findByIdAndUpdate(userId, update, { new: true });
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error.message);
    // Depending on your error handling strategy, you might want to throw the error
    // or log it more prominently. For now, we'll just log and continue.
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate('department', 'name') // Populate department name
      .populate('team', 'name')       // Populate team name
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET a single user by ID
exports.getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('department', 'name')
      .populate('team', 'name');
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

exports.createUser = async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// UPDATE user
exports.updateUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updated);
  } catch (err) {
    // Handle invalid ID format errors
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }
    res.status(400).json({ error: err.message });
  }
};

// DELETE user
exports.deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    // Handle invalid ID format errors
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }
    res.status(400).json({ error: err.message });
  }
};

// New function to handle user transfer
exports.transferUserTeam = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { newDepartmentId, newTeamId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const originalTeamId = user.team ? user.team.toString() : null;
    const originalDepartmentId = user.department ? user.department.toString() : null;

    // 1. Unassign from original team if applicable
    if (originalTeamId && originalTeamId !== newTeamId) {
      const originalTeam = await Team.findById(originalTeamId);
      if (originalTeam) {
        // Remove from members
        originalTeam.members = originalTeam.members.filter(memberId => memberId.toString() !== userId);
        // If they were the leader of the old team, unassign them
        if (originalTeam.teamLeader && originalTeam.teamLeader.toString() === userId) {
          originalTeam.teamLeader = null;
        }
        await originalTeam.save();
      }
    }

    // 2. Assign to new team if provided
    let resolvedDepartmentId = newDepartmentId || null; // Start with requested newDepartmentId

    if (newTeamId) {
      const newTeam = await Team.findById(newTeamId);
      if (!newTeam) {
        return res.status(400).json({ message: 'New team not found.' });
      }
      // Ensure the department is consistent with the new team's department
      resolvedDepartmentId = newTeam.department;

      // Add user to new team's members if not already there
      if (!newTeam.members.includes(userId)) {
        newTeam.members.push(userId);
      }
      // If the user is a Team Leader, ensure they are also set as the leader of the new team if required.
      // This logic might need refinement based on whether a team can have multiple leaders, etc.
      // For simplicity, this example assumes a user with 'Team Leader' role can be set as leader if new team has none.
      if (user.role === 'Team Leader' && !newTeam.teamLeader) {
          newTeam.teamLeader = userId;
      }
      await newTeam.save();
    }

    // 3. Update the user's document directly
    await updateUserTeamAndDepartment(userId, newTeamId, resolvedDepartmentId);

    // Re-fetch the user to return the updated document with populated fields
    const updatedUser = await User.findById(userId)
                                  .populate('team', 'name')
                                  .populate('department', 'name');

    res.json({ message: 'User transferred successfully', user: updatedUser });

  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ error: err.message });
  }
};