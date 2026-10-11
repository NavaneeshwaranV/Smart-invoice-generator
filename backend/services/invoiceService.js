import Invoice from '../models/Invoice.js';
import { isMongoConnected, readLocalStore, writeLocalStore, generateLocalId } from '../config/db.js';
import { calculateInvoiceTotals } from '../utils/calculations.js';
import { generateNextInvoiceNumber } from '../utils/invoiceNumber.js';

export const buildInvoiceDocument = async (userId, payload, existingInvoice = null) => {
  const totals = calculateInvoiceTotals({
    items: payload.items || [],
    gstEnabled: payload.gstEnabled !== undefined ? Boolean(payload.gstEnabled) : true,
    invoiceDiscount: payload.invoiceDiscount || 0,
    additionalCharges: payload.additionalCharges || 0,
    previousDues: payload.previousDues || 0,
    amountPaid: payload.amountPaid || 0,
    requestedStatus: payload.status || 'Unpaid',
  });

  const invoiceNumber =
    payload.invoiceNumber && String(payload.invoiceNumber).trim() !== ''
      ? String(payload.invoiceNumber).trim()
      : existingInvoice?.invoiceNumber || (await generateNextInvoiceNumber(userId));

  return {
    userId,
    invoiceNumber,
    invoiceDate: String(payload.invoiceDate).trim(),
    dueDate: payload.dueDate ? String(payload.dueDate).trim() : '',
    customerId: payload.customerId ? String(payload.customerId).trim() : '',
    customer: {
      name: String(payload.customer?.name || '').trim(),
      phone: String(payload.customer?.phone || '').trim(),
      email: String(payload.customer?.email || '').trim().toLowerCase(),
      address: String(payload.customer?.address || '').trim(),
      city: String(payload.customer?.city || '').trim(),
      country: String(payload.customer?.country || 'India').trim(),
      gstin: String(payload.customer?.gstin || '').trim().toUpperCase(),
    },
    fromDetails: payload.fromDetails
      ? {
          businessName: String(payload.fromDetails.businessName || '').trim(),
          email: String(payload.fromDetails.email || '').trim(),
          phone: String(payload.fromDetails.phone || '').trim(),
          address: String(payload.fromDetails.address || '').trim(),
          city: String(payload.fromDetails.city || '').trim(),
          country: String(payload.fromDetails.country || 'India').trim(),
          gstin: String(payload.fromDetails.gstin || '').trim().toUpperCase(),
        }
      : existingInvoice?.fromDetails || {},
    ...totals,
    paymentMethod: payload.paymentMethod || 'UPI',
    notes: String(payload.notes || '').trim(),
  };
};

/**
 * Advanced Search & Filtering for Invoices:
 * Supports:
 * - search: matches invoiceNumber, customer.name, customer.phone, customer.email, or item names
 * - invoiceNumber: explicit filter on invoice number
 * - customerName: explicit filter on customer name
 * - status: All | Paid | Unpaid | Partially Paid | Draft (also supports comma-separated multi-status)
 * - startDate / endDate: inclusive YYYY-MM-DD date range filter
 * - minAmount / maxAmount: grandTotal numeric filter
 * - customerId: filter invoices for a specific customer
 * - sortBy: date_desc (default) | date_asc | amount_desc | amount_asc | number_asc
 */
export const queryInvoicesForUser = async (userId, query = {}) => {
  const {
    search = '',
    invoiceNumber = '',
    customerName = '',
    status = '',
    startDate = '',
    endDate = '',
    minAmount = '',
    maxAmount = '',
    customerId = '',
    sortBy = 'date_desc',
  } = query;

  let invoices = [];

  if (isMongoConnected()) {
    const filter = { userId };

    if (status && status !== 'All') {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    if (customerId) {
      filter.customerId = String(customerId).trim();
    }

    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = String(startDate).trim();
      if (endDate) filter.invoiceDate.$lte = String(endDate).trim();
    }

    if (minAmount !== '' || maxAmount !== '') {
      filter.grandTotal = {};
      if (minAmount !== '' && Number.isFinite(Number(minAmount))) {
        filter.grandTotal.$gte = Number(minAmount);
      }
      if (maxAmount !== '' && Number.isFinite(Number(maxAmount))) {
        filter.grandTotal.$lte = Number(maxAmount);
      }
    }

    if (invoiceNumber) {
      filter.invoiceNumber = { $regex: String(invoiceNumber).trim(), $options: 'i' };
    }

    if (customerName) {
      filter['customer.name'] = { $regex: String(customerName).trim(), $options: 'i' };
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { 'customer.name': { $regex: q, $options: 'i' } },
        { 'customer.phone': { $regex: q, $options: 'i' } },
        { 'customer.gstin': { $regex: q, $options: 'i' } },
      ];
    }

    let sortSpec = { invoiceDate: -1, createdAt: -1 };
    if (sortBy === 'date_asc') sortSpec = { invoiceDate: 1, createdAt: 1 };
    else if (sortBy === 'amount_desc') sortSpec = { grandTotal: -1 };
    else if (sortBy === 'amount_asc') sortSpec = { grandTotal: 1 };
    else if (sortBy === 'number_asc') sortSpec = { invoiceNumber: 1 };

    invoices = await Invoice.find(filter).sort(sortSpec).lean();
  } else {
    const store = readLocalStore();
    invoices = store.invoices.filter((inv) => inv.userId === userId);

    if (status && status !== 'All') {
      const statuses = String(status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      invoices = invoices.filter((inv) => statuses.includes(inv.status));
    }

    if (customerId) {
      invoices = invoices.filter((inv) => inv.customerId === String(customerId).trim());
    }

    if (startDate) {
      invoices = invoices.filter((inv) => String(inv.invoiceDate) >= String(startDate).trim());
    }

    if (endDate) {
      invoices = invoices.filter((inv) => String(inv.invoiceDate) <= String(endDate).trim());
    }

    if (minAmount !== '' && Number.isFinite(Number(minAmount))) {
      invoices = invoices.filter((inv) => Number(inv.grandTotal) >= Number(minAmount));
    }

    if (maxAmount !== '' && Number.isFinite(Number(maxAmount))) {
      invoices = invoices.filter((inv) => Number(inv.grandTotal) <= Number(maxAmount));
    }

    if (invoiceNumber && String(invoiceNumber).trim()) {
      const numQ = String(invoiceNumber).trim().toLowerCase();
      invoices = invoices.filter((inv) =>
        String(inv.invoiceNumber || '')
          .toLowerCase()
          .includes(numQ)
      );
    }

    if (customerName && String(customerName).trim()) {
      const custQ = String(customerName).trim().toLowerCase();
      invoices = invoices.filter((inv) =>
        String(inv.customer?.name || '')
          .toLowerCase()
          .includes(custQ)
      );
    }

    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      invoices = invoices.filter(
        (inv) =>
          String(inv.invoiceNumber || '')
            .toLowerCase()
            .includes(q) ||
          String(inv.customer?.name || '')
            .toLowerCase()
            .includes(q) ||
          String(inv.customer?.phone || '')
            .toLowerCase()
            .includes(q) ||
          String(inv.customer?.gstin || '')
            .toLowerCase()
            .includes(q) ||
          (Array.isArray(inv.items) &&
            inv.items.some((it) =>
              String(it.name || '')
                .toLowerCase()
                .includes(q)
            ))
      );
    }

    invoices.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return String(a.invoiceDate).localeCompare(String(b.invoiceDate));
      }
      if (sortBy === 'amount_desc') {
        return Number(b.grandTotal) - Number(a.grandTotal);
      }
      if (sortBy === 'amount_asc') {
        return Number(a.grandTotal) - Number(b.grandTotal);
      }
      if (sortBy === 'number_asc') {
        return String(a.invoiceNumber).localeCompare(String(b.invoiceNumber));
      }
      return (
        String(b.invoiceDate).localeCompare(String(a.invoiceDate)) ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
    });
  }

  return invoices;
};
