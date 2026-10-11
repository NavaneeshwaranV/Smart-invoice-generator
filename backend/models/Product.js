import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'Clerk userId is required'],
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Product or service name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      maxlength: [40, 'SKU/HSN code cannot exceed 40 characters'],
    },
    hsnCode: {
      type: String,
      trim: true,
      default: '',
      maxlength: [20, 'HSN/SAC code cannot exceed 20 characters'],
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [400, 'Description cannot exceed 400 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Price cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 18,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    unit: {
      type: String,
      trim: true,
      default: 'Nos',
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ userId: 1, name: 1 });
productSchema.index({ userId: 1, sku: 1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
