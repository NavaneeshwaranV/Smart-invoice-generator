import Invoice from '../models/Invoice.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { isMongoConnected, readLocalStore, writeLocalStore, generateLocalId } from '../config/db.js';
import { buildInvoiceDocument, queryInvoicesForUser } from '../services/invoiceService.js';
import { generateNextInvoiceNumber } from '../utils/invoiceNumber.js';
import { streamInvoicePDF } from '../services/pdfService.js';
import { toPaise, toRupees } from '../utils/calculations.js';

export const getNextInvoiceNumber = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const invoiceNumber = await generateNextInvoiceNumber(userId);
    return res.json({ success: true, invoiceNumber });
  } catch (err) {
    next(err);
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const invoices = await queryInvoicesForUser(userId, req.query);

    // Compute filtered summary totals for the active filter set
    let totalAmountPaise = 0;
    let paidAmountPaise = 0;
    let balanceDuePaise = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'Draft') {
        totalAmountPaise += toPaise(inv.grandTotal);
        paidAmountPaise += toPaise(inv.amountPaid);
        balanceDuePaise += toPaise(inv.balanceDue);
      }
    });

    return res.json({
      success: true,
      count: invoices.length,
      summary: {
        filteredCount: invoices.length,
        totalAmount: toRupees(totalAmountPaise),
        paidAmount: toRupees(paidAmountPaise),
        balanceDue: toRupees(balanceDuePaise),
      },
      data: invoices,
    });
  } catch (err) {
    next(err);
  }
};

export const getInvoiceById = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    if (isMongoConnected()) {
      const invoice = await Invoice.findOne({ _id: id, userId }).lean();
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }
      return res.json({ success: true, data: invoice });
    }

    const store = readLocalStore();
    const invoice = store.invoices.find((inv) => inv._id === id && inv.userId === userId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    return res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

export const createInvoice = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const docData = await buildInvoiceDocument(userId, req.body);
    docData.auditLog = [
      {
        action: 'Created',
        timestamp: new Date().toISOString(),
        note: `Invoice created with status ${docData.status}`,
      },
    ];

    if (isMongoConnected()) {
      const created = await Invoice.create(docData);
      return res.status(201).json({
        success: true,
        message: `Invoice ${created.invoiceNumber} saved successfully.`,
        data: created,
      });
    }

    const store = readLocalStore();
    // Prevent duplicate invoiceNumber for the same user
    const duplicate = store.invoices.find(
      (inv) =>
        inv.userId === userId &&
        String(inv.invoiceNumber).toLowerCase() === String(docData.invoiceNumber).toLowerCase()
    );
    if (duplicate) {
      docData.invoiceNumber = await generateNextInvoiceNumber(userId);
    }

    const newInvoice = {
      _id: generateLocalId('inv'),
      ...docData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.invoices.push(newInvoice);
    writeLocalStore(store);

    return res.status(201).json({
      success: true,
      message: `Invoice ${newInvoice.invoiceNumber} saved successfully.`,
      data: newInvoice,
    });
  } catch (err) {
    next(err);
  }
};

export const updateInvoice = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    if (isMongoConnected()) {
      const existing = await Invoice.findOne({ _id: id, userId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }

      const updatedFields = await buildInvoiceDocument(userId, req.body, existing);
      const auditEntry = {
        action: 'Updated',
        timestamp: new Date(),
        note: `Updated invoice (status: ${updatedFields.status}, total: ₹${updatedFields.grandTotal})`,
      };

      const saved = await Invoice.findOneAndUpdate(
        { _id: id, userId },
        {
          $set: updatedFields,
          $push: { auditLog: auditEntry },
        },
        { new: true, runValidators: true }
      ).lean();

      return res.json({
        success: true,
        message: `Invoice ${saved.invoiceNumber} updated successfully.`,
        data: saved,
      });
    }

    const store = readLocalStore();
    const idx = store.invoices.findIndex((inv) => inv._id === id && inv.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const existing = store.invoices[idx];
    const updatedFields = await buildInvoiceDocument(userId, req.body, existing);
    const auditLog = Array.isArray(existing.auditLog) ? [...existing.auditLog] : [];
    auditLog.push({
      action: 'Updated',
      timestamp: new Date().toISOString(),
      note: `Updated invoice (status: ${updatedFields.status}, total: ₹${updatedFields.grandTotal})`,
    });

    store.invoices[idx] = {
      ...existing,
      ...updatedFields,
      auditLog,
      updatedAt: new Date().toISOString(),
    };
    writeLocalStore(store);

    return res.json({
      success: true,
      message: `Invoice ${store.invoices[idx].invoiceNumber} updated successfully.`,
      data: store.invoices[idx],
    });
  } catch (err) {
    next(err);
  }
};

export const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const { status, amountPaid, paymentMethod } = req.body;

    if (isMongoConnected()) {
      const existing = await Invoice.findOne({ _id: id, userId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }

      const grandTotalPaise = toPaise(existing.grandTotal);
      let newPaidPaise =
        amountPaid !== undefined ? Math.max(0, toPaise(amountPaid)) : toPaise(existing.amountPaid);

      if (status === 'Paid') {
        newPaidPaise = grandTotalPaise;
      } else if (status === 'Unpaid') {
        newPaidPaise = 0;
      }

      const newBalancePaise = Math.max(0, grandTotalPaise - newPaidPaise);
      const finalStatus =
        status ||
        (newBalancePaise === 0 ? 'Paid' : newPaidPaise > 0 ? 'Partially Paid' : 'Unpaid');

      existing.status = finalStatus;
      existing.amountPaid = toRupees(newPaidPaise);
      existing.balanceDue = toRupees(newBalancePaise);
      if (paymentMethod) existing.paymentMethod = paymentMethod;
      existing.auditLog.push({
        action: 'Payment/Status Updated',
        timestamp: new Date(),
        note: `Status changed to ${finalStatus} (Paid: ₹${existing.amountPaid})`,
      });

      await existing.save();
      return res.json({
        success: true,
        message: `Invoice marked as ${finalStatus}.`,
        data: existing,
      });
    }

    const store = readLocalStore();
    const idx = store.invoices.findIndex((inv) => inv._id === id && inv.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const existing = store.invoices[idx];
    const grandTotalPaise = toPaise(existing.grandTotal);
    let newPaidPaise =
      amountPaid !== undefined ? Math.max(0, toPaise(amountPaid)) : toPaise(existing.amountPaid);

    if (status === 'Paid') {
      newPaidPaise = grandTotalPaise;
    } else if (status === 'Unpaid') {
      newPaidPaise = 0;
    }

    const newBalancePaise = Math.max(0, grandTotalPaise - newPaidPaise);
    const finalStatus =
      status || (newBalancePaise === 0 ? 'Paid' : newPaidPaise > 0 ? 'Partially Paid' : 'Unpaid');

    store.invoices[idx] = {
      ...existing,
      status: finalStatus,
      amountPaid: toRupees(newPaidPaise),
      balanceDue: toRupees(newBalancePaise),
      paymentMethod: paymentMethod || existing.paymentMethod,
      updatedAt: new Date().toISOString(),
    };
    writeLocalStore(store);

    return res.json({
      success: true,
      message: `Invoice marked as ${finalStatus}.`,
      data: store.invoices[idx],
    });
  } catch (err) {
    next(err);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    if (isMongoConnected()) {
      const existing = await Invoice.findOne({ _id: id, userId }).lean();
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Invoice not found.' });
      }
      await Invoice.deleteOne({ _id: id, userId });
      return res.json({
        success: true,
        message: `Invoice ${existing.invoiceNumber} deleted successfully.`,
      });
    }

    const store = readLocalStore();
    const idx = store.invoices.findIndex((inv) => inv._id === id && inv.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    const removed = store.invoices.splice(idx, 1)[0];
    writeLocalStore(store);

    return res.json({
      success: true,
      message: `Invoice ${removed.invoiceNumber} deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

export const downloadInvoicePDF = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    let invoice = null;
    let businessProfile = null;

    if (isMongoConnected()) {
      invoice = await Invoice.findOne({ _id: id, userId }).lean();
      businessProfile = await BusinessProfile.findOne({ userId }).lean();
    } else {
      const store = readLocalStore();
      invoice = store.invoices.find((inv) => inv._id === id && inv.userId === userId);
      businessProfile = store.businessProfiles.find((b) => b.userId === userId);
    }

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    streamInvoicePDF(invoice, businessProfile, res);
  } catch (err) {
    next(err);
  }
};
