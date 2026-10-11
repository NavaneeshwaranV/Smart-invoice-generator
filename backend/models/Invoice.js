import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    hsnCode: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be greater than zero'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    lineSubtotal: {
      type: Number,
      required: true,
    },
    lineNet: {
      type: Number,
      required: true,
    },
    lineTax: {
      type: Number,
      required: true,
    },
    lineTotal: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'Clerk userId is required'],
      index: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
    },
    invoiceDate: {
      type: String,
      required: [true, 'Invoice date is required'],
      index: true,
    },
    dueDate: {
      type: String,
      default: '',
    },
    customerId: {
      type: String,
      default: '',
      index: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
      },
      address: {
        type: String,
        trim: true,
        default: '',
      },
      city: {
        type: String,
        trim: true,
        default: '',
      },
      country: {
        type: String,
        trim: true,
        default: 'India',
      },
      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        default: '',
      },
    },
    fromDetails: {
      businessName: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'India' },
      gstin: { type: String, trim: true, default: '' },
    },
    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one invoice item is required',
      },
    },
    gstEnabled: {
      type: Boolean,
      default: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    itemDiscountTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    invoiceDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    additionalCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    previousDues: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Draft', 'Unpaid', 'Partially Paid', 'Paid'],
      default: 'Unpaid',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'],
      default: 'UPI',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    auditLog: [
      {
        action: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Unique invoice number per business userId + performance indexes for search & filtering
invoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ userId: 1, invoiceDate: -1 });
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ userId: 1, 'customer.name': 1 });

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

export default Invoice;
