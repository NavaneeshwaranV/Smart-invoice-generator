import Customer from '../models/Customer.js';
import Invoice from '../models/Invoice.js';
import { isMongoConnected, readLocalStore, writeLocalStore, generateLocalId } from '../config/db.js';
import { toPaise, toRupees } from '../utils/calculations.js';

/**
 * List customers for the authenticated user with advanced search and filtering:
 * - search: customer name, phone, email, or GSTIN
 * - balanceFilter: 'all' | 'outstanding' (balanceDue > 0) | 'settled' (balanceDue == 0 & totalBilled > 0) | 'no_invoices'
 * - billedFrom / billedTo: filter customers who have been billed within [billedFrom, billedTo]
 * - sortBy: 'name_asc' | 'balance_desc' | 'billed_desc' | 'recent_desc'
 */
export const getCustomers = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const {
      search = '',
      balanceFilter = 'all',
      billedFrom = '',
      billedTo = '',
      sortBy = 'name_asc',
    } = req.query;

    let customers = [];
    let invoices = [];

    if (isMongoConnected()) {
      const custFilter = { userId };
      if (search && String(search).trim()) {
        const q = String(search).trim();
        custFilter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { gstin: { $regex: q, $options: 'i' } },
        ];
      }
      customers = await Customer.find(custFilter).lean();
      invoices = await Invoice.find({ userId }).sort({ invoiceDate: -1 }).lean();
    } else {
      const store = readLocalStore();
      customers = store.customers.filter((c) => c.userId === userId);
      if (search && String(search).trim()) {
        const q = String(search).trim().toLowerCase();
        customers = customers.filter(
          (c) =>
            String(c.name || '')
              .toLowerCase()
              .includes(q) ||
            String(c.phone || '')
              .toLowerCase()
              .includes(q) ||
            String(c.email || '')
              .toLowerCase()
              .includes(q) ||
            String(c.gstin || '')
              .toLowerCase()
              .includes(q)
        );
      }
      invoices = store.invoices
        .filter((inv) => inv.userId === userId)
        .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
    }

    // Aggregate billing metrics per customer
    const enriched = customers.map((cust) => {
      const custIdStr = String(cust._id);
      const custNameLower = String(cust.name || '').trim().toLowerCase();

      const matchingInvoices = invoices.filter(
        (inv) =>
          String(inv.customerId) === custIdStr ||
          String(inv.customer?.name || '').trim().toLowerCase() === custNameLower
      );

      let totalBilledPaise = 0;
      let totalPaidPaise = 0;
      let outstandingPaise = 0;
      let lastBilledDate = '';
      let billedInPeriodCount = 0;
      let billedInPeriodPaise = 0;

      matchingInvoices.forEach((inv) => {
        const invDate = String(inv.invoiceDate || '');
        if (!lastBilledDate || invDate > lastBilledDate) {
          lastBilledDate = invDate;
        }

        if (inv.status !== 'Draft') {
          totalBilledPaise += toPaise(inv.grandTotal);
          totalPaidPaise += toPaise(inv.amountPaid);
          outstandingPaise += toPaise(inv.balanceDue);
        }

        const afterFrom = !billedFrom || invDate >= String(billedFrom).trim();
        const beforeTo = !billedTo || invDate <= String(billedTo).trim();
        if (afterFrom && beforeTo && inv.status !== 'Draft') {
          billedInPeriodCount += 1;
          billedInPeriodPaise += toPaise(inv.grandTotal);
        }
      });

      return {
        ...cust,
        invoiceCount: matchingInvoices.length,
        totalBilled: toRupees(totalBilledPaise),
        totalPaid: toRupees(totalPaidPaise),
        outstandingBalance: toRupees(outstandingPaise),
        lastBilledDate: lastBilledDate || null,
        billedInPeriodCount,
        billedInPeriodAmount: toRupees(billedInPeriodPaise),
        invoices: matchingInvoices.map((inv) => ({
          _id: inv._id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          grandTotal: inv.grandTotal,
          amountPaid: inv.amountPaid,
          balanceDue: inv.balanceDue,
          status: inv.status,
          paymentMethod: inv.paymentMethod,
        })),
      };
    });

    // Apply balanceFilter
    let filtered = enriched;
    if (balanceFilter === 'outstanding') {
      filtered = filtered.filter((c) => c.outstandingBalance > 0);
    } else if (balanceFilter === 'settled') {
      filtered = filtered.filter((c) => c.outstandingBalance === 0 && c.totalBilled > 0);
    } else if (balanceFilter === 'no_invoices') {
      filtered = filtered.filter((c) => c.invoiceCount === 0);
    }

    // Apply billed period filter if billedFrom or billedTo is active
    if (billedFrom || billedTo) {
      filtered = filtered.filter((c) => c.billedInPeriodCount > 0);
    }

    // Sort results
    filtered.sort((a, b) => {
      if (sortBy === 'balance_desc') {
        return b.outstandingBalance - a.outstandingBalance;
      }
      if (sortBy === 'billed_desc') {
        return b.totalBilled - a.totalBilled;
      }
      if (sortBy === 'recent_desc') {
        return String(b.lastBilledDate || '').localeCompare(String(a.lastBilledDate || ''));
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return res.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    if (isMongoConnected()) {
      const customer = await Customer.findOne({ _id: id, userId }).lean();
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      const invoices = await Invoice.find({
        userId,
        $or: [{ customerId: String(customer._id) }, { 'customer.name': customer.name }],
      })
        .sort({ invoiceDate: -1 })
        .lean();
      return res.json({ success: true, data: { ...customer, invoices } });
    }

    const store = readLocalStore();
    const customer = store.customers.find((c) => c._id === id && c.userId === userId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const invoices = store.invoices
      .filter(
        (inv) =>
          inv.userId === userId &&
          (inv.customerId === customer._id ||
            String(inv.customer?.name || '').toLowerCase() ===
              String(customer.name || '').toLowerCase())
      )
      .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));

    return res.json({ success: true, data: { ...customer, invoices } });
  } catch (err) {
    next(err);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const payload = {
      userId,
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      address: String(req.body.address || '').trim(),
      gstin: String(req.body.gstin || '').trim().toUpperCase(),
      notes: String(req.body.notes || '').trim(),
    };

    if (isMongoConnected()) {
      const created = await Customer.create(payload);
      return res.status(201).json({
        success: true,
        message: 'Customer added successfully.',
        data: created,
      });
    }

    const store = readLocalStore();
    const newCustomer = {
      _id: generateLocalId('cust'),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.customers.push(newCustomer);
    writeLocalStore(store);

    return res.status(201).json({
      success: true,
      message: 'Customer added successfully.',
      data: newCustomer,
    });
  } catch (err) {
    next(err);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const updates = {
      name: String(req.body.name || '').trim(),
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      address: String(req.body.address || '').trim(),
      gstin: String(req.body.gstin || '').trim().toUpperCase(),
      notes: String(req.body.notes || '').trim(),
    };

    if (isMongoConnected()) {
      const updated = await Customer.findOneAndUpdate(
        { _id: id, userId },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      return res.json({
        success: true,
        message: 'Customer updated successfully.',
        data: updated,
      });
    }

    const store = readLocalStore();
    const idx = store.customers.findIndex((c) => c._id === id && c.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    store.customers[idx] = {
      ...store.customers[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeLocalStore(store);

    return res.json({
      success: true,
      message: 'Customer updated successfully.',
      data: store.customers[idx],
    });
  } catch (err) {
    next(err);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    if (isMongoConnected()) {
      const deleted = await Customer.findOneAndDelete({ _id: id, userId }).lean();
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      return res.json({
        success: true,
        message: 'Customer deleted successfully.',
      });
    }

    const store = readLocalStore();
    const idx = store.customers.findIndex((c) => c._id === id && c.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    store.customers.splice(idx, 1);
    writeLocalStore(store);

    return res.json({
      success: true,
      message: 'Customer deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};
