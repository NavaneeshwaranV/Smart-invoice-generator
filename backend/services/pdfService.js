import PDFDocument from 'pdfkit';

const formatINR = (num) => {
  const n = Number(num || 0);
  return `Rs. ${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Generates a professional A4 Tax Invoice PDF using PDFKit,
 * matching the structured Tax Invoice layout with HSN code, Payment Details, and Totals table.
 */
export const streamInvoicePDF = (invoice, businessProfile, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const safeFilename = String(invoice.invoiceNumber || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);

  doc.pipe(res);

  const primaryTeal = '#1496B0';
  const primaryBlue = '#2563EB';
  const darkText = '#1E293B';
  const mutedText = '#64748B';
  const lightBg = '#F8FAFC';
  const borderGray = '#CBD5E1';

  // Top Accent Rule
  doc.rect(40, 35, 515, 4).fill(primaryTeal);

  // Company Header (Left) & Tax Invoice Title (Right)
  const companyName =
    invoice.fromDetails?.businessName ||
    businessProfile?.businessName ||
    'Smart Invoice Business';
  const companyAddress =
    invoice.fromDetails?.address ||
    businessProfile?.shopAddress ||
    '';
  const companyPhone = invoice.fromDetails?.phone || businessProfile?.phone || '';
  const companyEmail = invoice.fromDetails?.email || businessProfile?.email || '';
  const companyGstin = invoice.fromDetails?.gstin || businessProfile?.gstin || '';

  doc.font('Helvetica-Bold').fontSize(18).fillColor(primaryTeal).text(companyName, 40, 52, {
    width: 320,
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(primaryTeal)
    .text(invoice.gstEnabled ? 'Tax Invoice' : 'Invoice', 360, 52, {
      width: 195,
      align: 'right',
    });

  let leftY = 78;
  doc.font('Helvetica').fontSize(9.5).fillColor(mutedText);
  if (companyAddress) {
    doc.text(companyAddress, 40, leftY, { width: 280 });
    leftY += 26;
  }
  if (companyPhone) {
    doc.text(`Phone: ${companyPhone}`, 40, leftY);
    leftY += 14;
  }
  if (companyEmail) {
    doc.text(`Email: ${companyEmail}`, 40, leftY);
    leftY += 14;
  }

  let rightY = 78;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(darkText);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 350, rightY, { width: 205, align: 'right' });
  rightY += 14;
  doc.font('Helvetica').fillColor(mutedText);
  doc.text(`Date: ${invoice.invoiceDate || '-'}`, 350, rightY, { width: 205, align: 'right' });
  rightY += 14;
  if (companyGstin) {
    doc.text(`GSTIN: ${companyGstin}`, 350, rightY, { width: 205, align: 'right' });
    rightY += 14;
  }
  doc
    .font('Helvetica-Bold')
    .fillColor(
      invoice.status === 'Paid'
        ? '#16A34A'
        : invoice.status === 'Partially Paid'
          ? '#D97706'
          : '#DC2626'
    )
    .text(`Status: ${invoice.status}`, 350, rightY, { width: 205, align: 'right' });

  // Bill To Shaded Band
  const bandTop = Math.max(leftY, rightY) + 14;
  doc.rect(40, bandTop, 515, 86).fill(lightBg);

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(primaryTeal).text('Bill To', 52, bandTop + 10);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(darkText)
    .text(invoice.customer?.name || 'Walk-in Customer', 52, bandTop + 26, { width: 250 });

  doc.font('Helvetica').fontSize(9).fillColor(mutedText);
  let custY = bandTop + 40;
  if (invoice.customer?.address) {
    doc.text(invoice.customer.address, 52, custY, { width: 250 });
    custY += 22;
  }
  if (invoice.customer?.phone) {
    doc.text(`Phone: ${invoice.customer.phone}`, 52, custY);
  }

  // Right side of Bill To band
  const metaLabelX = 330;
  const metaValX = 430;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primaryTeal);
  doc.text('Invoice Date', metaLabelX, bandTop + 24);
  doc.text('Due Date', metaLabelX, bandTop + 42);
  doc.text('Customer GSTIN', metaLabelX, bandTop + 60);

  doc.font('Helvetica').fontSize(9.5).fillColor(darkText);
  doc.text(invoice.invoiceDate || '-', metaValX, bandTop + 24, { width: 115, align: 'right' });
  doc.text(invoice.dueDate || '-', metaValX, bandTop + 42, { width: 115, align: 'right' });
  doc.text(invoice.customer?.gstin || 'N/A', metaValX, bandTop + 60, { width: 115, align: 'right' });

  // Items Table Header
  let tableY = bandTop + 102;
  const colX = {
    id: 40,
    desc: 70,
    hsn: 270,
    qty: 330,
    rate: 385,
    amount: 465,
    end: 555,
  };

  const drawRowBorders = (y, h) => {
    doc.lineWidth(0.5).strokeColor(borderGray);
    doc.rect(40, y, 515, h).stroke();
    [colX.desc, colX.hsn, colX.qty, colX.rate, colX.amount].forEach((x) => {
      doc.moveTo(x, y).lineTo(x, y + h).stroke();
    });
  };

  drawRowBorders(tableY, 24);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryTeal);
  doc.text('ID', colX.id + 4, tableY + 7, { width: 22, align: 'center' });
  doc.text('Description', colX.desc + 6, tableY + 7, { width: 190 });
  doc.text('HSN', colX.hsn + 4, tableY + 7, { width: 52, align: 'center' });
  doc.text('Qty', colX.qty + 4, tableY + 7, { width: 46, align: 'center' });
  doc.text('Rate', colX.rate + 4, tableY + 7, { width: 74, align: 'right' });
  doc.text('Amount', colX.amount + 4, tableY + 7, { width: 84, align: 'right' });

  tableY += 24;

  // Table Rows
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((item, idx) => {
    if (tableY > 680) {
      doc.addPage();
      tableY = 50;
    }
    const rowHeight = item.description ? 30 : 22;
    drawRowBorders(tableY, rowHeight);

    doc.font('Helvetica').fontSize(9).fillColor(darkText);
    doc.text(String(idx + 1), colX.id + 4, tableY + 6, { width: 22, align: 'center' });
    doc.font('Helvetica-Bold').text(item.name || 'Item', colX.desc + 6, tableY + 5, { width: 190 });
    if (item.description) {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(mutedText)
        .text(item.description, colX.desc + 6, tableY + 17, { width: 190, height: 11 });
    }
    doc.font('Helvetica').fontSize(9).fillColor(darkText);
    doc.text(item.hsnCode || '-', colX.hsn + 4, tableY + 6, { width: 52, align: 'center' });
    doc.text(String(item.quantity), colX.qty + 4, tableY + 6, { width: 46, align: 'center' });
    doc.text(formatINR(item.unitPrice), colX.rate + 4, tableY + 6, { width: 74, align: 'right' });
    doc.text(formatINR(item.lineNet), colX.amount + 4, tableY + 6, { width: 84, align: 'right' });

    tableY += rowHeight;
  });

  // Payment Details (Left) & Totals Box (Right)
  const footerStartY = tableY + 12;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(mutedText).text('Thank you for your business!', 40, footerStartY);

  let payY = footerStartY + 22;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryTeal).text('Payment Details', 40, payY);
  payY += 16;
  doc.font('Helvetica').fontSize(8.5).fillColor(mutedText);
  doc.text(`• Payment Method: ${invoice.paymentMethod || 'UPI'}`, 46, payY);
  payY += 13;
  if (businessProfile?.businessName) {
    doc.text(`• Account Name: ${businessProfile.businessName}`, 46, payY);
    payY += 13;
  }
  if (businessProfile?.accountNumber) {
    doc.text(`• Account Number: ${businessProfile.accountNumber}`, 46, payY);
    payY += 13;
  }
  if (businessProfile?.bankName) {
    doc.text(`• Bank Name: ${businessProfile.bankName}`, 46, payY);
    payY += 13;
  }
  if (businessProfile?.ifscCode) {
    doc.text(`• IFSC Code: ${businessProfile.ifscCode}`, 46, payY);
    payY += 13;
  }
  if (businessProfile?.upiId) {
    doc.text(`• UPI ID: ${businessProfile.upiId}`, 46, payY);
    payY += 13;
  }

  // Right Totals Table
  const totX = 330;
  const totValX = 445;
  const totW = 225;
  let totY = tableY;

  const totalDiscount = Number(invoice.itemDiscountTotal || 0) + Number(invoice.invoiceDiscount || 0);
  const summaryRows = [
    ['Sub total', formatINR(invoice.subtotal)],
    ['Discount', formatINR(totalDiscount)],
    ['Tax (GST)', invoice.gstEnabled ? formatINR(invoice.taxAmount) : 'Rs. 0.00'],
    ['Shipping / Charges', formatINR(invoice.additionalCharges || 0)],
    ['Previous dues', formatINR(invoice.previousDues || 0)],
  ];

  summaryRows.forEach(([label, val]) => {
    doc.lineWidth(0.5).strokeColor(borderGray).rect(totX, totY, totW, 20).stroke();
    doc.moveTo(totValX, totY).lineTo(totValX, totY + 20).stroke();
    doc.font('Helvetica').fontSize(9).fillColor(darkText).text(label, totX + 8, totY + 6);
    doc.text(val, totValX + 4, totY + 6, { width: 104, align: 'right' });
    totY += 20;
  });

  // Grand Total Highlight Row
  doc.rect(totX, totY, totW, 28).fill(primaryTeal);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('Total', totX + 8, totY + 8);
  doc.text(formatINR(invoice.grandTotal), totValX + 4, totY + 8, { width: 104, align: 'right' });
  totY += 32;

  if (Number(invoice.balanceDue) > 0) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(primaryBlue)
      .text(
        `Paid: ${formatINR(invoice.amountPaid)}   |   Balance Due: ${formatINR(invoice.balanceDue)}`,
        totX,
        totY + 2,
        { width: totW, align: 'right' }
      );
  }

  doc.end();
};
