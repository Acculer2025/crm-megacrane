// routes/notesRoutes.js
const express = require('express');
const router = express.Router();
const BusinessAccount = require('../models/BusinessAccount');
const Invoice = require('../models/Invoice');
const Note = require('../models/noteModel');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// Add note to business account
// This route is specific and should be placed before more general ones.
router.post('/business-accounts/:id/notes', auth, async (req, res) => {
  try {
    const { text } = req.body;
    // Ensure req.user.id is populated by your auth middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'User not authenticated' });
    }

    const note = {
      text,
      createdBy: req.user.id,
      timestamp: new Date() // Add timestamp when created
    };

    const businessAccount = await BusinessAccount.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: note } },
      { new: true, runValidators: true } // runValidators to ensure note schema is respected
    );

    if (!businessAccount) {
        return res.status(404).json({ msg: 'Business Account not found' });
    }

    // Return the newly added note or the updated notes array
    res.status(201).json(businessAccount.notes.slice(-1)[0]); // Return the last added note
  } catch (error) {
    console.error('Error adding note to business account:', error.message);
    res.status(500).send('Server Error');
  }
});

// Add note to invoice
// This route is specific and should be placed before more general ones.
router.post('/invoices/:id/notes', auth, async (req, res) => {
  try {
    const { text } = req.body;
    // Ensure req.user.id is populated by your auth middleware
    if (!req.user || !req.user.id) {
        return res.status(401).json({ msg: 'User not authenticated' });
    }

    const note = {
      text,
      createdBy: req.user.id,
      timestamp: new Date() // Add timestamp when created
    };

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: note } },
      { new: true, runValidators: true } // runValidators to ensure note schema is respected
    );

    if (!invoice) {
        return res.status(404).json({ msg: 'Invoice not found' });
    }

    res.status(201).json(invoice.notes.slice(-1)[0]); // Return the last added note
  } catch (error) {
    console.error('Error adding note to invoice:', error.message);
    res.status(500).send('Server Error');
  }
});

// Update note (more specific routes should be handled before this general one if applicable)
// This route handles both 'business-accounts' and 'invoices' via the :model parameter.
router.put('/:model/:id/notes/:noteId', auth, async (req, res) => {
  try {
    const { model, id, noteId } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === '') {
        return res.status(400).json({ msg: 'Note text cannot be empty' });
    }

    let Model;
    if (model === 'business-accounts') {
      Model = BusinessAccount;
    } else if (model === 'invoices') {
      Model = Invoice;
    } else {
      return res.status(400).json({ msg: 'Invalid model type provided' });
    }

    const updatedDoc = await Model.findOneAndUpdate(
      { _id: id, 'notes._id': noteId },
      { $set: { 'notes.$.text': text, 'notes.$.timestamp': Date.now() } }, // Update timestamp on modification
      { new: true, runValidators: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ msg: 'Document or Note not found' });
    }

    const updatedNote = updatedDoc.notes.find(note => note._id.toString() === noteId);
    if (!updatedNote) {
        return res.status(404).json({ msg: 'Note not found within the document' });
    }
    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error.message);
    res.status(500).send('Server Error');
  }
});

// Delete note (more specific routes should be handled before this general one if applicable)
// This route handles both 'business-accounts' and 'invoices' via the :model parameter.
router.delete('/:model/:id/notes/:noteId', auth, async (req, res) => {
  try {
    const { model, id, noteId } = req.params;

    let Model;
    if (model === 'business-accounts') {
      Model = BusinessAccount;
    } else if (model === 'invoices') {
      Model = Invoice;
    } else {
      return res.status(400).json({ msg: 'Invalid model type provided' });
    }

    const updatedDoc = await Model.findByIdAndUpdate(
      id,
      { $pull: { notes: { _id: noteId } } },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ msg: 'Document or Note not found' });
    }

    // You might want to return a success message or the remaining notes
    res.json({ msg: 'Note deleted successfully', remainingNotes: updatedDoc.notes });
  } catch (error) {
    console.error('Error deleting note:', error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;