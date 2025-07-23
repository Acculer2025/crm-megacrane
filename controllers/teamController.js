// controllers/teamController.js
const Team = require('../models/Team');
const User = require('../models/User');
const Department = require('../models/Department');

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

// Create Team
exports.createTeam = async (req, res) => {
  try {
    const { name, department, teamLeader, members } = req.body;

    // Validate department existence
    const existingDepartment = await Department.findById(department);
    if (!existingDepartment) {
      return res.status(400).json({ message: 'Department not found.' });
    }

    // Validate teamLeader (if provided)
    if (teamLeader) {
      const leader = await User.findById(teamLeader);
      if (!leader) {
        return res.status(400).json({ message: 'Team Leader not found.' });
      }
      if (leader.role !== 'Team Leader') {
        return res.status(400).json({ message: 'Assigned user is not a Team Leader.' });
      }
      // Check if this leader already leads another team
      const existingTeamWithLeader = await Team.findOne({ teamLeader: teamLeader });
      if (existingTeamWithLeader) {
        return res.status(400).json({ message: 'This user is already a Team Leader for another team.' });
      }
    }

    const newTeam = await Team.create({ name, department, teamLeader, members });

    // Update teamLeader's user document to assign them to this team
    if (teamLeader) {
      await updateUserTeamAndDepartment(teamLeader, newTeam._id, department);
    }
    // Update members' user documents to assign them to this team
    // Ensure members array is always handled, even if empty or null
    for (const memberId of (members || [])) {
      await updateUserTeamAndDepartment(memberId, newTeam._id, department);
    }

    res.status(201).json(newTeam);
  } catch (err) {
    console.error("Error in createTeam:", err); // Log the full error
    if (err.code === 11000) { // Duplicate key error
      if (err.keyPattern && err.keyPattern.teamLeader) {
        return res.status(400).json({ message: 'The selected user is already a Team Leader for another team.' });
      }
      return res.status(400).json({ message: 'Team with this name already exists.' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Get All Teams (with population for frontend display)
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('department', 'name') // Populate department name
      .populate('teamLeader', 'name email') // Populate team leader name and email
      .populate('members', 'name email') // Populate member names and emails
      .sort({ name: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Single Team (with population for frontend display)
exports.getSingleTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('department', 'name')
      .populate('teamLeader', 'name email')
      .populate('members', 'name email');
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    res.json(team);
  } catch (err) {
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Team ID format' });
    }
    res.status(500).json({ error: err.message });
  }
};

// Update Team
exports.updateTeam = async (req, res) => {
  try {
    const { name, department, teamLeader, members } = req.body;
    const teamId = req.params.id;

    const originalTeam = await Team.findById(teamId);
    if (!originalTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Validate department existence if changed
    if (department && department.toString() !== originalTeam.department.toString()) {
      const existingDepartment = await Department.findById(department);
      if (!existingDepartment) {
        return res.status(400).json({ message: 'Department not found.' });
      }
    }

    // Validate teamLeader (if provided and changed)
    // IMPORTANT: Ensure the originalTeam.teamLeader is checked for existence before toString()
    const currentLeaderId = originalTeam.teamLeader ? originalTeam.teamLeader.toString() : null;
    const newLeaderId = teamLeader ? teamLeader.toString() : null;

    if (newLeaderId && newLeaderId !== currentLeaderId) { // If a new leader is provided and different from the current
      const leader = await User.findById(newLeaderId);
      if (!leader) {
        return res.status(400).json({ message: 'Team Leader not found.' });
      }
      if (leader.role !== 'Team Leader') {
        return res.status(400).json({ message: 'Assigned user is not a Team Leader.' });
      }
      // Check if this leader already leads another team (excluding the current team being updated)
      const existingTeamWithLeader = await Team.findOne({ teamLeader: newLeaderId, _id: { $ne: teamId } });
      if (existingTeamWithLeader) {
        return res.status(400).json({ message: 'This user is already a Team Leader for another team.' });
      }
    }
    // If teamLeader is being set to null, no validation needed beyond that.

    // Perform the update
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { name, department, teamLeader: newLeaderId, members: members || [] }, // Ensure members is an array
      { new: true, runValidators: true }
    );

    // --- CRITICAL: Update user documents based on changes ---

    // 1. Handle Team Leader changes:
    // If previous leader exists AND is different from new leader OR new leader is null, unassign previous.
    if (currentLeaderId && currentLeaderId !== newLeaderId) {
      await updateUserTeamAndDepartment(currentLeaderId, null, null);
    }
    // If a new leader is assigned (or current leader re-assigned), assign them.
    if (newLeaderId) {
      // Use the potentially new department if provided, otherwise stick to original
      await updateUserTeamAndDepartment(newLeaderId, updatedTeam._id, department || originalTeam.department);
    }

    // 2. Handle Team Members changes:
    const originalMemberIds = originalTeam.members.map(String);
    const newMemberIds = (members || []).map(String);
    const resolvedDepartmentId = department || originalTeam.department; // Use new department if changed, else old

    // Unassign members who were in the original team but are not in the new list
    for (const originalMemberId of originalMemberIds) {
      if (!newMemberIds.includes(originalMemberId)) {
        await updateUserTeamAndDepartment(originalMemberId, null, null);
      }
    }

    // Assign new members (or re-assign existing ones, though the update function is idempotent)
    for (const newMemberId of newMemberIds) {
      // Only assign if they were not already assigned to this team (optimization, not strictly necessary due to idempotence)
      // Or if their team/department needs updating due to team or department change
      const user = await User.findById(newMemberId);
      if (!user || user.team?.toString() !== updatedTeam._id.toString() || user.department?.toString() !== resolvedDepartmentId.toString()) {
         await updateUserTeamAndDepartment(newMemberId, updatedTeam._id, resolvedDepartmentId);
      }
    }

    res.json(updatedTeam);
  } catch (err) {
    console.error("Error in updateTeam:", err); // Log the full error
    if (err.code === 11000) { // Duplicate key error
      if (err.keyPattern && err.keyPattern.teamLeader) {
        return res.status(400).json({ message: 'The selected user is already a Team Leader for another team.' });
      }
      return res.status(400).json({ message: 'Team with this name already exists.' });
    }
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Team ID format' });
    }
    res.status(400).json({ error: err.message });
  }
};

// Delete Team
exports.deleteTeam = async (req, res) => {
  try {
    const teamId = req.params.id;
    const deletedTeam = await Team.findByIdAndDelete(teamId);

    if (!deletedTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // --- CRITICAL: Unassign team leader and members from the deleted team ---

    // Remove team and department association from team leader
    if (deletedTeam.teamLeader) {
      await updateUserTeamAndDepartment(deletedTeam.teamLeader, null, null);
    }
    // Remove team and department association from all members
    for (const memberId of deletedTeam.members) {
      await updateUserTeamAndDepartment(memberId, null, null);
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error("Error in deleteTeam:", err); // Log the full error
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid Team ID format' });
    }
    res.status(400).json({ error: err.message });
  }
};