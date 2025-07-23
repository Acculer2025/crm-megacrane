const Invoice = require('../models/Invoice');
const BusinessAccount = require('../models/BusinessAccount');

// GET all invoices
exports.getAll = async (req, res) => {
  try {
    // Fetch only 'Invoice' type documents
    const invoices = await Invoice.find({ invoiceType: 'Invoice' })
      .populate('businessId')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    console.error("Error in getAll invoices:", err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// POST create a new invoice
exports.create = async (req, res) => {
  try {
    const { items, taxRate = 18, discountAmount = 0, ...rest } = req.body; // invoiceType is now fixed to 'Invoice'
    let nextNumber;
    let invoiceFields = {};

    // Generate invoice number for 'Invoice' type only
    const lastInvoice = await Invoice.findOne({ invoiceType: 'Invoice' }).sort({ createdAt: -1 });
    nextNumber = lastInvoice?.invoiceNumber
      ? `INV-${String(parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1).padStart(4, '0')}`
      : 'INV-0001';
    invoiceFields.invoiceNumber = nextNumber;

    const calculatedItems = items || [];
    const subTotal = calculatedItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const tax = subTotal * (taxRate / 100);
    const totalAmount = subTotal + tax - discountAmount;

    const invoice = new Invoice({
      ...rest,
      ...invoiceFields,
      invoiceType: 'Invoice', // Hardcode invoiceType to 'Invoice'
      items: calculatedItems,
      subTotal,
      tax,
      taxRate,
      discountAmount,
      totalAmount,
      businessName: req.body.businessName,
      customerName: req.body.customerName,
      customerAddress: req.body.customerAddress,
      customerGSTIN: req.body.customerGSTIN,
      companyGSTIN: req.body.companyGSTIN,
      companyName: req.body.companyName,
      companyAddress: req.body.companyAddress,
      contactPerson: req.body.contactPerson,
      contactNumber: req.body.contactNumber,
      paymentTerms: req.body.paymentTerms,
      // NEW FIELDS: Add contactName, email, mobileNumber
      contactName: req.body.contactName,
      email: req.body.email,
      mobileNumber: req.body.mobileNumber,
    });

    const saved = await invoice.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Error creating invoice:", err);
    res.status(400).json({ error: err.message });
  }
};

// Removed getInvoiceTypes, convertToInvoice, updateProformaStatus as Proforma is removed.

// PATCH: Add payment to invoice with validation
exports.addPayment = async (req, res) => {
  try {
    const { amount, method, reference, date, addedBy } = req.body;
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount. Must be a positive number.' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const currentTotalPaid = invoice.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const invoiceTotal = invoice.totalAmount || 0;

    if (currentTotalPaid + paymentAmount > invoiceTotal) {
      return res.status(400).json({ error: 'Adding this payment would exceed the total invoice amount.' });
    }

    const payment = { amount: paymentAmount, method, reference, date, addedBy };

    invoice.paymentHistory.push(payment);
    await invoice.save();

    res.json(invoice);
  } catch (err) {
    console.error("Error adding payment:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('businessId');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    console.error("Error getting invoice by ID:", err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

exports.updatePaymentHistory = async (req, res) => {
  try {
    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      { paymentHistory: req.body.paymentHistory },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("Error updating payment history:", err);
    res.status(400).json({ error: err.message });
  }
};

// PUT update invoice (blocked if isClosed is true)
exports.update = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.isClosed) return res.status(403).json({ error: 'Invoice is locked and cannot be edited' });

    const { items, taxRate = 18, discountAmount = 0, ...rest } = req.body;

    const calculatedItems = items || [];
    const subTotal = calculatedItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const tax = subTotal * (taxRate / 100);
    const totalAmount = subTotal + tax - discountAmount;

    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        ...rest,
        items: calculatedItems,
        subTotal,
        tax,
        taxRate,
        discountAmount,
        totalAmount,
        businessName: req.body.businessName,
        customerName: req.body.customerName,
        customerAddress: req.body.customerAddress,
        companyGSTIN: req.body.companyGSTIN,
        companyName: req.body.companyName,
        companyAddress: req.body.companyAddress,
        contactPerson: req.body.contactPerson,
        contactNumber: req.body.contactNumber,
        paymentTerms: req.body.paymentTerms,
        // NEW FIELDS: Update contactName, email, mobileNumber
        contactName: req.body.contactName,
        email: req.body.email,
        mobileNumber: req.body.mobileNumber,
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("Error updating invoice:", err);
    res.status(400).json({ error: err.message });
  }
};

// DELETE invoice (blocked if isClosed is true)
exports.remove = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.isClosed) return res.status(403).json({ error: 'Invoice is locked and cannot be deleted' });

    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error("Error removing invoice:", err);
    res.status(400).json({ error: err.message });
  }
};

// GET active businesses
exports.getActiveBusinesses = async (req, res) => {
  try {
    const businesses = await BusinessAccount.find({ status: 'Active' });
    res.json(businesses);
  } catch (err) {
    console.error("Error getting active businesses:", err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
};

// PATCH close invoice
exports.closeInvoice = async (req, res) => {
  try {
    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      { isClosed: true },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("Error closing invoice:", err);
    res.status(400).json({ error: err.message });
  }
};

// PATCH unlock invoice
exports.unlockInvoice = async (req, res) => {
  try {
    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      { isClosed: false },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("Error unlocking invoice:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getInvoicesByBusinessId = async (req, res) => {
  try {
    const invoices = await Invoice.find({ businessId: req.params.id });
    res.json(invoices);
  } catch (err) {
    console.error("Error getting invoices by business ID:", err);
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
};

exports.getPaymentsByBusinessId = async (req, res) => {
  try {
    const invoices = await Invoice.find({ businessId: req.params.id });
    const allPayments = invoices.flatMap(inv => inv.paymentHistory || []);
    res.json(allPayments);
  } catch (err) {
    console.error("Error getting payments by business ID:", err);
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
};

// Get follow-ups by invoice ID (changed from account ID)
exports.getFollowUpsByInvoiceId = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('followUps.addedBy', 'name email');

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    res.json(invoice.followUps || []);
  } catch (err) {
    console.error("Error fetching follow-ups by invoice ID:", err);
    res.status(500).json({ message: 'Failed to fetch follow-ups', error: err.message });
  }
};

// ADD a follow-up to an invoice
exports.addFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, note, addedBy } = req.body;

    if (!date || !note || !addedBy) {
      return res.status(400).json({ message: 'Date, note, and addedBy are required.' });
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });

    invoice.followUps.push({ date, note, addedBy });
    await invoice.save();

    res.status(200).json({ message: 'Follow-up added', followUps: invoice.followUps });
  } catch (error) {
    console.error("Error adding follow-up:", error);
    res.status(500).json({ message: 'Failed to add follow-up', error: error.message });
  }
};

// UPDATE follow-up by index on an invoice
exports.updateFollowUp = async (req, res) => {
  const { id, index } = req.params;
  const { date, note, status } = req.body;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice || !invoice.followUps[index]) {
      return res.status(404).json({ message: 'Follow-up not found.' });
    }

    invoice.followUps[index].date = date;
    invoice.followUps[index].note = note;
    invoice.followUps[index].status = status;
    await invoice.save();

    res.status(200).json({ message: 'Follow-up updated', followUps: invoice.followUps });
  } catch (error) {
    console.error("Error updating follow-up:", error);
    res.status(500).json({ message: 'Error updating follow-up', error: error.message });
  }
};

// DELETE follow-up by index on an invoice
exports.deleteFollowUp = async (req, res) => {
  const { id, index } = req.params;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice || !invoice.followUps[index]) {
      return res.status(404).json({ message: 'Follow-up not found.' });
    }

    invoice.followUps.splice(index, 1);
    await invoice.save();

    res.status(200).json({ message: 'Follow-up deleted', followUps: invoice.followUps });
  } catch (error) {
    console.error("Error deleting follow-up:", error);
    res.status(500).json({ message: 'Error deleting follow-up', error: error.message });
  }
};

// NEW: Delete a specific payment from an invoice's payment history
exports.deletePayment = async (req, res) => {
  try {
    const { invoiceId, paymentId } = req.params;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const paymentIndex = invoice.paymentHistory.findIndex(p => p._id.toString() === paymentId);

    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'Payment not found in this invoice' });
    }

    invoice.paymentHistory.splice(paymentIndex, 1);

    await invoice.save();

    res.json({ message: 'Payment deleted successfully', invoice });
  } catch (err) {
    console.error("Error deleting payment:", err);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
};
