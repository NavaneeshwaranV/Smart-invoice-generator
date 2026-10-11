import mongoose from 'mongoose';

const businessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'Clerk userId is required'],
      unique: true,
      index: true,
      trim: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [120, 'Business name cannot exceed 120 characters'],
    },
    ownerName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Owner name cannot exceed 100 characters'],
    },
    shopAddress: {
      type: String,
      trim: true,
      default: '',
      maxlength: [400, 'Address cannot exceed 400 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [30, 'Phone number cannot exceed 30 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [20, 'GSTIN cannot exceed 20 characters'],
    },
    gstEnabled: {
      type: Boolean,
      default: true,
    },
    defaultTaxRate: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    currencySymbol: {
      type: String,
      default: '₹',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
    },
    invoicePrefix: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'INV',
      maxlength: [10, 'Invoice prefix cannot exceed 10 characters'],
    },
    termsAndConditions: {
      type: String,
      trim: true,
      default:
        '1. Goods once sold will be exchanged only within 7 days with original bill.\n2. Subject to local jurisdiction.',
    },
  },
  {
    timestamps: true,
  }
);

const BusinessProfile =
  mongoose.models.BusinessProfile || mongoose.model('BusinessProfile', businessProfileSchema);

export default BusinessProfile;
