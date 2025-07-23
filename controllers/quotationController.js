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
const calculateTotal = (subTotal, gstBreakdown, gstType, manualGstAmount, manualSgstPercentage, manualCgstPercentage) => {
  let taxToUse = 0;

  if (manualGstAmount !== null && manualGstAmount !== undefined) {
      // If overall manual total GST (absolute amount) is set, use it directly (highest precedence)
      taxToUse = manualGstAmount;
  } else if (gstType === "intrastate" && (manualSgstPercentage !== null || manualCgstPercentage !== null)) {
      // If intrastate and manual SGST/CGST percentages are set, calculate their absolute values
      const manualSgstValue = manualSgstPercentage !== null && manualSgstPercentage !== undefined ? (subTotal * (manualSgstPercentage / 100)) : gstBreakdown.sgst;
      const manualCgstValue = manualCgstPercentage !== null && manualCgstPercentage !== undefined ? (subTotal * (manualCgstPercentage / 100)) : gstBreakdown.cgst;
      taxToUse = manualSgstValue + manualCgstValue;
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
    const { items, businessId, customerName, customerEmail, mobileNumber, gstin, gstType, quotationDate, validityDays, quotationNotes, businessInfo, manualGstAmount, manualSgstPercentage, manualCgstPercentage } = req.body;

    // Fetch the last quotation to determine the next quotation number
    const lastQuotation = await Quotation.findOne().sort({ createdAt: -1 });
    let nextQuotationNumber;
    if (lastQuotation && lastQuotation.quotationNumber) {
      const lastNumber = parseInt(lastQuotation.quotationNumber.split('-').pop());
      nextQuotationNumber = `Q-${(lastNumber + 1).toString().padStart(5, '0')}`;
    } else {
      nextQuotationNumber = 'Q-00001';
    }

    // Calculate subTotal
    const subTotal = calculateSubTotal(items);

    // Calculate GST breakdown
    const gstBreakdown = calculateTotalGst(items, gstType);

    // Calculate total, applying manual overrides if present
    const total = calculateTotal(subTotal, gstBreakdown, gstType, manualGstAmount, manualSgstPercentage, manualCgstPercentage);

    const newQuotation = new Quotation({
      quotationNumber: nextQuotationNumber,
      businessId,
      customerName: customerName || (businessId ? (await Business.findById(businessId))?.contactName : null),
      customerEmail: customerEmail || (businessId ? (await Business.findById(businessId))?.email : null),
      mobileNumber: mobileNumber || (businessId ? (await Business.findById(businessId))?.mobileNumber || (await Business.findById(businessId))?.phone : null),
      gstin: gstin || (businessId ? (await Business.findById(businessId))?.gstin : null),
      gstType,
      items,
      subTotal,
      gstBreakdown,
      total,
      date: quotationDate || new Date(),
      validityDays,
      notes: quotationNotes ? [{ text: quotationNotes, author: req.user.name }] : [], // Assuming req.user is populated by auth middleware
      businessInfo,
      status: 'Pending',
      manualGstAmount,
      manualSgstPercentage,
      manualCgstPercentage,
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

    // Recalculate totals if items or GST related fields are updated
    if (updateData.items || updateData.gstType !== undefined || updateData.manualGstAmount !== undefined || updateData.manualSgstPercentage !== undefined || updateData.manualCgstPercentage !== undefined) {
      const itemsToUse = updateData.items || quotation.items;
      const gstTypeToUse = updateData.gstType !== undefined ? updateData.gstType : quotation.gstType;
      const manualGstAmountToUse = updateData.manualGstAmount !== undefined ? updateData.manualGstAmount : quotation.manualGstAmount;
      const manualSgstPercentageToUse = updateData.manualSgstPercentage !== undefined ? updateData.manualSgstPercentage : quotation.manualSgstPercentage;
      const manualCgstPercentageToUse = updateData.manualCgstPercentage !== undefined ? updateData.manualCgstPercentage : quotation.manualCgstPercentage;

      const newSubTotal = calculateSubTotal(itemsToUse);
      const newGstBreakdown = calculateTotalGst(itemsToUse, gstTypeToUse);
      const newTotal = calculateTotal(newSubTotal, newGstBreakdown, gstTypeToUse, manualGstAmountToUse, manualSgstPercentageToUse, manualCgstPercentageToUse);

      quotation.subTotal = newSubTotal;
      quotation.gstBreakdown = newGstBreakdown;
      quotation.total = newTotal;
      quotation.items = itemsToUse; // Update items if they were changed
      quotation.gstType = gstTypeToUse;
      quotation.manualGstAmount = manualGstAmountToUse;
      quotation.manualSgstPercentage = manualSgstPercentageToUse;
      quotation.manualCgstPercentage = manualCgstPercentageToUse;
    }

    // Handle notes separately if they are being added
    if (updateData.notes && updateData.notes.length > 0) {
      // Assuming 'notes' here refers to adding new notes, not replacing old ones
      // You might need more sophisticated logic here based on your frontend's note management
      updateData.notes.forEach(newNote => {
        if (newNote.text) {
          quotation.notes.push({
            text: newNote.text,
            author: req.user.name, // Assuming req.user is populated by auth middleware
            timestamp: new Date()
          });
        }
      });
      delete updateData.notes; // Remove from updateData to prevent direct overwrite
    }


    // Apply other updates
    Object.keys(updateData).forEach(key => {
      // Prevent overwriting calculated fields or specific fields not meant for direct update here
      if (key !== 'items' && key !== 'subTotal' && key !== 'gstBreakdown' && key !== 'total' && key !== 'createdAt' && key !== 'notes') {
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
      addedBy: req.user._id, // Assuming user ID is available from authentication middleware
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