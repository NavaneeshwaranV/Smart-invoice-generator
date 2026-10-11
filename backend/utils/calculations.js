/**
 * Server-side integer paise arithmetic utility.
 * Converts Rupees to integer paise (1 Rupee = 100 Paise) before all calculations
 * to eliminate IEEE-754 floating-point rounding errors.
 */

export const toPaise = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
};

export const toRupees = (paise) => {
  return Number((Math.round(paise) / 100).toFixed(2));
};

export const calculateInvoiceTotals = ({
  items = [],
  gstEnabled = true,
  invoiceDiscount = 0,
  additionalCharges = 0,
  previousDues = 0,
  amountPaid = 0,
  requestedStatus = 'Unpaid',
}) => {
  let subtotalPaise = 0;
  let itemDiscountTotalPaise = 0;
  let totalTaxPaise = 0;

  const computedItems = items.map((item) => {
    const quantity = Math.max(0.01, Number(item.quantity) || 1);
    const unitPricePaise = Math.max(0, toPaise(item.unitPrice));
    const lineSubtotalPaise = Math.round(quantity * unitPricePaise);
    const discountPaise = Math.min(lineSubtotalPaise, Math.max(0, toPaise(item.discount || 0)));
    const lineNetPaise = Math.max(0, lineSubtotalPaise - discountPaise);

    const taxRate = gstEnabled ? Math.max(0, Math.min(100, Number(item.taxRate ?? 0))) : 0;
    const lineTaxPaise = Math.round((lineNetPaise * taxRate) / 100);
    const lineTotalPaise = lineNetPaise + lineTaxPaise;

    subtotalPaise += lineSubtotalPaise;
    itemDiscountTotalPaise += discountPaise;
    totalTaxPaise += lineTaxPaise;

    return {
      productId: item.productId ? String(item.productId).trim() : '',
      name: String(item.name || '').trim(),
      description: String(item.description || '').trim(),
      hsnCode: String(item.hsnCode || '').trim(),
      quantity,
      unitPrice: toRupees(unitPricePaise),
      discount: toRupees(discountPaise),
      taxRate,
      lineSubtotal: toRupees(lineSubtotalPaise),
      lineNet: toRupees(lineNetPaise),
      lineTax: toRupees(lineTaxPaise),
      lineTotal: toRupees(lineTotalPaise),
    };
  });

  const netAfterItemDiscountPaise = Math.max(0, subtotalPaise - itemDiscountTotalPaise);
  const invoiceDiscountPaise = Math.min(
    netAfterItemDiscountPaise,
    Math.max(0, toPaise(invoiceDiscount))
  );
  const additionalChargesPaise = Math.max(0, toPaise(additionalCharges));
  const previousDuesPaise = Math.max(0, toPaise(previousDues));

  const grandTotalPaise = Math.max(
    0,
    netAfterItemDiscountPaise -
      invoiceDiscountPaise +
      totalTaxPaise +
      additionalChargesPaise +
      previousDuesPaise
  );

  let amountPaidPaise = Math.max(0, toPaise(amountPaid));
  let finalStatus = requestedStatus;

  if (requestedStatus === 'Draft') {
    finalStatus = 'Draft';
    amountPaidPaise = Math.min(grandTotalPaise, amountPaidPaise);
  } else if (requestedStatus === 'Paid' || (amountPaidPaise >= grandTotalPaise && grandTotalPaise > 0)) {
    finalStatus = 'Paid';
    amountPaidPaise = grandTotalPaise;
  } else if (amountPaidPaise > 0 && amountPaidPaise < grandTotalPaise) {
    finalStatus = 'Partially Paid';
  } else if (requestedStatus === 'Partially Paid' && amountPaidPaise === 0) {
    finalStatus = 'Partially Paid';
  } else {
    finalStatus = 'Unpaid';
    amountPaidPaise = 0;
  }

  const balanceDuePaise = Math.max(0, grandTotalPaise - amountPaidPaise);

  return {
    items: computedItems,
    gstEnabled: Boolean(gstEnabled),
    subtotal: toRupees(subtotalPaise),
    itemDiscountTotal: toRupees(itemDiscountTotalPaise),
    invoiceDiscount: toRupees(invoiceDiscountPaise),
    taxAmount: toRupees(totalTaxPaise),
    additionalCharges: toRupees(additionalChargesPaise),
    previousDues: toRupees(previousDuesPaise),
    grandTotal: toRupees(grandTotalPaise),
    amountPaid: toRupees(amountPaidPaise),
    balanceDue: toRupees(balanceDuePaise),
    status: finalStatus,
  };
};
