import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'Clerk userId is required'],
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [120, 'Customer name cannot exceed 120 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
      maxlength: [30, 'Phone number cannot exceed 30 characters'],
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
      maxlength: [400, 'Address cannot exceed 400 characters'],
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [20, 'GSTIN cannot exceed 20 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ userId: 1, name: 1 });
customerSchema.index({ userId: 1, phone: 1 });

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;
