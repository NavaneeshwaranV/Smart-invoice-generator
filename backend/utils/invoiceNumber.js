import Invoice from '../models/Invoice.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { isMongoConnected, readLocalStore } from '../config/db.js';

/**
 * Generates a unique, sequential invoice number for a given userId.
 * Format: <PREFIX>-YYYYMM-XXX (e.g., INV-202610-004)
 */
export const generateNextInvoiceNumber = async (userId) => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  let prefix = 'INV';

  if (isMongoConnected()) {
    const profile = await BusinessProfile.findOne({ userId }).lean();
    if (profile && profile.invoicePrefix) {
      prefix = profile.invoicePrefix.trim().toUpperCase();
    }

    const pattern = new RegExp(`^${prefix}-${yearMonth}-(\\d+)$`, 'i');
    const existing = await Invoice.find({ userId, invoiceNumber: pattern })
      .select('invoiceNumber')
      .lean();

    let maxSeq = 0;
    for (const inv of existing) {
      const match = inv.invoiceNumber.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}-${yearMonth}-${nextSeq}`;
  } else {
    const store = readLocalStore();
    const profile = store.businessProfiles.find((b) => b.userId === userId);
    if (profile && profile.invoicePrefix) {
      prefix = profile.invoicePrefix.trim().toUpperCase();
    }
    const pattern = new RegExp(`^${prefix}-${yearMonth}-(\\d+)$`, 'i');
    const userInvoices = store.invoices.filter((inv) => inv.userId === userId);
    let maxSeq = 0;
    for (const inv of userInvoices) {
      const match = String(inv.invoiceNumber || '').match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}-${yearMonth}-${nextSeq}`;
  }
};
