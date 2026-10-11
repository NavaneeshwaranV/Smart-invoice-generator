/**
 * Server-side request validators for Invoices, Customers, Products, and Business Profiles.
 */

export const validateInvoicePayload = (body) => {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return ['Invalid request payload'];
  }

  if (!body.invoiceDate || String(body.invoiceDate).trim() === '') {
    errors.push('Invoice date is required.');
  }

  const customerName = body.customer?.name ? String(body.customer.name).trim() : '';
  if (!customerName) {
    errors.push('Customer name is required.');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('At least one product or service item is required.');
  } else {
    body.items.forEach((item, index) => {
      const itemName = String(item.name || '').trim();
      if (!itemName) {
        errors.push(`Item #${index + 1}: Product/service name is required.`);
      }
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        errors.push(`Item #${index + 1} (${itemName || 'Unnamed'}): Quantity must be greater than 0.`);
      }
      const price = Number(item.unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        errors.push(`Item #${index + 1} (${itemName || 'Unnamed'}): Unit price cannot be negative.`);
      }
      const discount = Number(item.discount || 0);
      if (!Number.isFinite(discount) || discount < 0) {
        errors.push(`Item #${index + 1} (${itemName || 'Unnamed'}): Discount cannot be negative.`);
      }
      const taxRate = Number(item.taxRate ?? 0);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        errors.push(`Item #${index + 1} (${itemName || 'Unnamed'}): Tax rate must be between 0% and 100%.`);
      }
    });
  }

  if (body.additionalCharges !== undefined && Number(body.additionalCharges) < 0) {
    errors.push('Additional/shipping charges cannot be negative.');
  }

  if (body.invoiceDiscount !== undefined && Number(body.invoiceDiscount) < 0) {
    errors.push('Invoice discount cannot be negative.');
  }

  if (body.previousDues !== undefined && Number(body.previousDues) < 0) {
    errors.push('Previous dues cannot be negative.');
  }

  return errors;
};

export const validateCustomerPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Invalid customer data'];

  if (!body.name || String(body.name).trim().length < 2) {
    errors.push('Customer name is required (at least 2 characters).');
  }
  if (!body.phone || String(body.phone).trim().length < 5) {
    errors.push('Valid phone number is required.');
  }
  return errors;
};

export const validateProductPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Invalid product data'];

  if (!body.name || String(body.name).trim().length < 2) {
    errors.push('Product or service name is required.');
  }
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    errors.push('Product unit price must be a non-negative number.');
  }
  const taxRate = Number(body.taxRate ?? 0);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    errors.push('Tax rate must be between 0 and 100.');
  }
  return errors;
};

export const validateBusinessProfilePayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Invalid business profile data'];

  if (!body.businessName || String(body.businessName).trim().length < 2) {
    errors.push('Business name is required.');
  }
  return errors;
};
