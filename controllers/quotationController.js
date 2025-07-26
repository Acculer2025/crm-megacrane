// quotationController.js
const Quotation = require('../models/Quotation');
const Business = require('../models/BusinessAccount');

// Helper function to format currency (for internal use if needed, but not directly for saving)
const formatCurrency = (amount) => {
  return parseFloat(Number(amount || 0).toFixed(2));
};

// Helper function to calculate sub-total
const calculateSubTotal = (items) => {
  return items.reduce((sum, i) => sum + (i.quantity || 0) * (i.rate || 0), 0);
};

// Helper function to calculate GST breakdown
const calculateTotalGst = (items, gstType) => {
  let totalCalculatedGst = items.reduce((sum, i) => {
    const itemTotal = (i.quantity || 0) * (i.rate || 0);
    const gstRate = (i.gstPercentage || 0) / 100; // Convert percentage to decimal
    return sum + itemTotal * gstRate;
  }, 0);

  let sgst = 0;
  let cgst = 0;
  let igst = 0;

  if (gstType === "intrastate") {
    sgst = totalCalculatedGst / 2;
    cgst = totalCalculatedGst / 2;
  } else if (gstType === "interstate") {
    igst = totalCalculatedGst;
  }

  return {
    totalGst: formatCurrency(totalCalculatedGst),
    sgst: formatCurrency(sgst),
    cgst: formatCurrency(cgst),
    igst: formatCurrency(igst),
  };
};

// Helper function to calculate the final total, applying manual overrides
const calculateTotal = (subTotal, gstBreakdown, gstType, manualGstAmount, manualSgstPercentage, manualCgstPercentage, manualIgstPercentage) => {
  let taxToUse = 0;

  if (manualGstAmount !== null && manualGstAmount !== undefined) {
      // If overall manual total GST (absolute amount) is set, use it directly (highest precedence)
      taxToUse = manualGstAmount;
  } else if (gstType === "intrastate" && (manualSgstPercentage !== null || manualCgstPercentage !== null)) {
      // If intrastate and manual SGST/CGST percentages are set, calculate their absolute values
      const manualSgstValue = manualSgstPercentage !== null && manualSgstPercentage !== undefined ? (subTotal * (manualSgstPercentage / 100)) : gstBreakdown.sgst;
      const manualCgstValue = manualCgstPercentage !== null && manualCgstPercentage !== undefined ? (subTotal * (manualCgstPercentage / 100)) : gstBreakdown.cgst;
      taxToUse = manualSgstValue + manualCgstValue;
  } else if (gstType === "interstate" && (manualIgstPercentage !== null && manualIgstPercentage !== undefined)) {
      taxToUse = subTotal * (manualIgstPercentage / 100);
  } else {
      // Otherwise, use the automatically calculated total GST
      taxToUse = gstBreakdown.totalGst;
  }

  return formatCurrency(subTotal + taxToUse);
};


// GET all quotations with pagination
exports.getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
    const skip = (page - 1) * limit;

    const totalQuotations = await Quotation.countDocuments(); // Get total count for pagination info
    const quotations = await Quotation.find()
      .populate('businessId', 'contactName email phone address gstin mobileNumber businessName')
      .populate('followUps.addedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip) // Skip documents based on current page
      .limit(limit); // Limit the number of documents per page

    res.json({
      quotations,
      currentPage: page,
      totalPages: Math.ceil(totalQuotations / limit),
      totalItems: totalQuotations,
      perPage: limit,
    });
  } catch (err) {
    console.error("Error fetching all quotations:", err);
    res.status(500).json({ error: 'Failed to fetch quotations. Please try again later.' });
  }
};

// POST create new quotation
exports.create = async (req, res) => {
  try {
    const { items, businessId, customerName, customerEmail,
      gstType, date, validUntil, notes, status, // Renamed from quotationDate, validityDays, quotationNotes
      manualGstAmount, manualSgstPercentage, manualCgstPercentage, manualIgstPercentage,
      quotationNumber // Added quotationNumber to allow frontend to set it
    } = req.body;

    // Use quotationNumber from frontend if provided, otherwise generate
    let finalQuotationNumber = quotationNumber;
    if (!finalQuotationNumber) {
        const lastQuotation = await Quotation.findOne().sort({ createdAt: -1 });
        if (lastQuotation && lastQuotation.quotationNumber) {
            const lastNum = parseInt(lastQuotation.quotationNumber.split('-').pop());
            finalQuotationNumber = `Q-${(lastNum + 1).toString().padStart(5, '0')}`;
        } else {
            finalQuotationNumber = 'Q-00001';
        }
    }

    // Calculate subTotal
    const subTotal = calculateSubTotal(items);

    // Calculate GST breakdown
    const gstBreakdown = calculateTotalGst(items, gstType);

    // Calculate total, applying manual overrides if present
    const total = calculateTotal(subTotal, gstBreakdown, gstType, manualGstAmount, manualSgstPercentage, manualCgstPercentage, manualIgstPercentage);

    // Fetch business details only if needed for fallback
    let businessDetails = null;
    if (businessId) {
      businessDetails = await Business.findById(businessId);
    }

    const newQuotation = new Quotation({
      quotationNumber: finalQuotationNumber, // Use the determined quotation number
      businessId,
      // Prioritize customerName/Email from body, fallback to business details
      customerName: customerName || businessDetails?.contactName || null,
      customerEmail: customerEmail || businessDetails?.email || null,
      mobileNumber: businessDetails?.mobileNumber || businessDetails?.phone || null,
      gstin: businessDetails?.gstNumber || null, // Changed from gstin to gstNumber to match Business schema likely
      gstType,
      items,
      subTotal,
      gstBreakdown,
      total,
      date: date || new Date(), // Use 'date' from frontend, fallback to new Date
      validUntil: validUntil || null, // Use 'validUntil' from frontend
      // Ensure notes are handled as an array of objects
      notes: notes && notes.length > 0 ? notes.map(note => ({
        ...note,
        author: note.author || req.user?.name || 'System', // Safely access req.user.name or default
        timestamp: note.timestamp || new Date()
      })) : [],
      status: status || 'Draft', // Use 'status' from frontend, fallback to 'Draft'
      manualGstAmount,
      manualSgstPercentage,
      manualCgstPercentage,
      manualIgstPercentage, // Store manualIgstPercentage
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newQuotation.save();
    res.status(201).json(newQuotation);
  } catch (err) {
    console.error("Error creating quotation:", err);
    if (err.code === 11000) { // Duplicate key error
      res.status(400).json({ error: 'A quotation with this number already exists. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to create quotation. Please try again later.' });
    }
  }
};

// PUT update a quotation by ID
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found.' });
    }

    // Merge incoming notes with existing notes
    if (updateData.notes && Array.isArray(updateData.notes) && updateData.notes.length > 0) {
      updateData.notes.forEach(newNote => {
        if (newNote.text) {
          quotation.notes.push({
            text: newNote.text,
            author: newNote.author || req.user?.name || 'System', // Safely access req.user.name or default
            timestamp: newNote.timestamp || new Date()
          });
        }
      });
      delete updateData.notes; // Prevent direct overwrite by mongoose
    }

    // Recalculate totals if items or GST related fields are updated
    const itemsChanged = updateData.items !== undefined;
    const gstTypeChanged = updateData.gstType !== undefined;
    const manualGstAmountChanged = updateData.manualGstAmount !== undefined;
    const manualSgstPercentageChanged = updateData.manualSgstPercentage !== undefined;
    const manualCgstPercentageChanged = updateData.manualCgstPercentage !== undefined;
    const manualIgstPercentageChanged = updateData.manualIgstPercentage !== undefined;


    if (itemsChanged || gstTypeChanged || manualGstAmountChanged || manualSgstPercentageChanged || manualCgstPercentageChanged || manualIgstPercentageChanged) {
      const itemsToUse = itemsChanged ? updateData.items : quotation.items;
      const gstTypeToUse = gstTypeChanged ? updateData.gstType : quotation.gstType;
      const manualGstAmountToUse = manualGstAmountChanged ? updateData.manualGstAmount : quotation.manualGstAmount;
      const manualSgstPercentageToUse = manualSgstPercentageChanged ? updateData.manualSgstPercentage : quotation.manualSgstPercentage;
      const manualCgstPercentageToUse = manualCgstPercentageChanged ? updateData.manualCgstPercentage : quotation.manualCgstPercentage;
      const manualIgstPercentageToUse = manualIgstPercentageChanged ? updateData.manualIgstPercentage : quotation.manualIgstPercentage;

      const newSubTotal = calculateSubTotal(itemsToUse);
      const newGstBreakdown = calculateTotalGst(itemsToUse, gstTypeToUse);
      const newTotal = calculateTotal(newSubTotal, newGstBreakdown, gstTypeToUse, manualGstAmountToUse, manualSgstPercentageToUse, manualCgstPercentageToUse, manualIgstPercentageToUse);

      quotation.subTotal = newSubTotal;
      quotation.gstBreakdown = newGstBreakdown;
      quotation.total = newTotal;
      quotation.items = itemsToUse; // Update items if they were changed
      quotation.gstType = gstTypeToUse;
      quotation.manualGstAmount = manualGstAmountToUse;
      quotation.manualSgstPercentage = manualSgstPercentageToUse;
      quotation.manualCgstPercentage = manualCgstPercentageToUse;
      quotation.manualIgstPercentage = manualIgstPercentageToUse; // Update manualIgstPercentage
    }


    // Apply other updates
    Object.keys(updateData).forEach(key => {
      // Prevent overwriting calculated fields or specific fields not meant for direct update here
      if (key !== 'items' && key !== 'subTotal' && key !== 'gstBreakdown' && key !== 'total' && key !== 'createdAt' && key !== 'notes' && key !== 'manualIgstPercentage') {
        quotation[key] = updateData[key];
      }
    });

    quotation.updatedAt = new Date();
    await quotation.save();

    // Re-populate for response
    const updatedQuotation = await Quotation.findById(id)
      .populate('businessId', 'contactName email phone address gstin mobileNumber businessName')
      .populate('followUps.addedBy', 'name email');

    res.json(updatedQuotation);
  } catch (err) {
    console.error("Error updating quotation:", err);
    res.status(500).json({ error: 'Failed to update quotation. Please try again later.' });
  }
};


// DELETE a quotation by ID
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await Quotation.findByIdAndDelete(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found.' });
    }
    res.status(200).json({ message: 'Quotation deleted successfully.' });
  } catch (err) {
    console.error("Error deleting quotation:", err);
    res.status(500).json({ error: 'Failed to delete quotation. Please try again later.' });
  }
};

// GET active businesses (for selection in quotation form, etc.)
exports.getActiveBusinesses = async (req, res) => {
  try {
    const activeBusinesses = await Business.find({ status: 'Active' }).select('_id businessName contactName email phone mobileNumber gstin address');
    res.json(activeBusinesses);
  } catch (err) {
    console.error("Error fetching active businesses:", err);
    res.status(500).json({ error: 'Failed to fetch active businesses.' });
  }
};

// Get quotations by businessId
exports.getQuotationsByBusinessId = async (req, res) => {
  try {
    const { id } = req.params;
    const quotations = await Quotation.find({ businessId: id })
      .populate('businessId', 'contactName email phone address gstin mobileNumber businessName')
      .populate('followUps.addedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (err) {
    console.error("Error fetching quotations by business ID:", err);
    res.status(500).json({ error: 'Failed to fetch quotations for the business.' });
  }
};


// --- FOLLOW-UP MANAGEMENT ---

// Get all follow-ups for a specific quotation (optional, could be done via main get)
exports.getFollowUpsByQuotationId = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await Quotation.findById(id).select('followUps').populate('followUps.addedBy', 'name email');
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found.' });
    }
    res.status(200).json(quotation.followUps);
  } catch (err) {
    console.error("Error fetching follow-ups:", err);
    res.status(500).json({ message: 'Failed to fetch follow-ups.', error: err.message });
  }
};

// Add a new follow-up to a specific quotation
exports.addFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, note, status } = req.body; // status can be 'Pending', 'Completed', 'Canceled'

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found.' });
    }

    quotation.followUps.push({
      date,
      note,
      status: status || 'Pending', // Default status
      addedBy: req.user?._id, // Safely access req.user._id
      timestamp: new Date()
    });

    await quotation.save();

    // Re-populate the addedBy field for the response
    const updatedQuotation = await Quotation.findById(id)
      .populate('followUps.addedBy', 'name email'); // Populate only the 'addedBy' in followUps

    res.status(200).json({ message: 'Follow-up added successfully.', followUps: updatedQuotation.followUps });
  } catch (err) {
    console.error("Error adding follow-up to quotation:", err);
    res.status(500).json({ message: 'Failed to add follow-up.', error: err.message });
  }
};

// Update a specific follow-up by its index on a quotation
exports.updateFollowUp = async (req, res) => {
  try {
    const { id, index } = req.params;
    const { date, note, status } = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation || !quotation.followUps[index]) {
      return res.status(404).json({ message: 'Follow-up not found.' });
    }

    quotation.followUps[index].date = date;
    quotation.followUps[index].note = note;
    if (status !== undefined) { // Only update status if explicitly provided
      quotation.followUps[index].status = status;
    }
    await quotation.save();

    const updatedQuotation = await Quotation.findById(id)
      .populate('followUps.addedBy', 'name email');

    res.status(200).json({ message: 'Follow-up updated successfully.', followUps: updatedQuotation.followUps });
  } catch (err) {
    console.error("Error updating follow-up on quotation:", err);
    res.status(500).json({ message: 'Failed to update follow-up.', error: err.message });
  }
};

// Delete a specific follow-up by its index from a quotation
exports.deleteFollowUp = async (req, res) => {
  try {
    const { id, index } = req.params;

    const quotation = await Quotation.findById(id);
    if (!quotation || !quotation.followUps[index]) {
      return res.status(404).json({ message: 'Follow-up not found.' });
    }

    quotation.followUps.splice(index, 1);
    await quotation.save();

    const updatedQuotation = await Quotation.findById(id)
      .populate('followUps.addedBy', 'name email');

    res.status(200).json({ message: 'Follow-up deleted successfully.', followUps: updatedQuotation.followUps });
  } catch (err) {
    console.error("Error deleting follow-up from quotation:", err);
    res.status(500).json({ message: 'Failed to delete follow-up.', error: err.message });
  }
};