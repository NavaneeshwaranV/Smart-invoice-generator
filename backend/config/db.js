import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // fallback to default
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoConnected = false;

/**
 * Connect to MongoDB Atlas using Mongoose.
 * If MONGODB_URI is not configured yet, falls back gracefully to persistent JSON storage
 * so the application remains 100% functional during local evaluation and testing.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI ? process.env.MONGODB_URI.trim() : '';

  if (!uri || uri === 'MY_MONGODB_URI' || uri.includes('<username>')) {
    console.log(
      '[Database] MONGODB_URI not configured with live credentials. Running with persistent JSON data store (backend/data/store.json). Set MONGODB_URI in .env to connect to MongoDB Atlas.'
    );
    ensureSeedData();
    mongoConnected = false;
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    mongoConnected = true;
    console.log(`[Database] MongoDB Atlas connected: ${conn.connection.host}`);
    
    // Seed initial collections if database is brand new
    try {
      const BusinessProfile = (await import('../models/BusinessProfile.js')).default;
      const Customer = (await import('../models/Customer.js')).default;
      const Product = (await import('../models/Product.js')).default;
      const Invoice = (await import('../models/Invoice.js')).default;

      const profileCount = await BusinessProfile.countDocuments();
      if (profileCount === 0) {
        console.log('[Database] Initializing MongoDB Atlas with starter seed data...');
        const seed = getDefaultSeedData();
        const stripId = (arr) => arr.map(({ _id, ...rest }) => rest);
        await BusinessProfile.insertMany(stripId(seed.businessProfiles));
        const insertedCustomers = await Customer.insertMany(stripId(seed.customers));
        const insertedProducts = await Product.insertMany(stripId(seed.products));

        // Link invoices to generated customer and product IDs
        const cust0 = insertedCustomers[0]?._id;
        const invoicesWithValidIds = seed.invoices.map(({ _id, ...inv }, idx) => {
          const cust = insertedCustomers[idx % insertedCustomers.length];
          return {
            ...inv,
            customerId: cust ? cust._id : undefined,
            customer: cust ? {
              name: cust.name,
              phone: cust.phone,
              email: cust.email,
              address: cust.address,
              gstin: cust.gstin,
            } : inv.customer,
            items: (inv.items || []).map(item => {
              const prod = insertedProducts.find(p => p.name === item.name) || insertedProducts[0];
              return {
                ...item,
                productId: prod ? prod._id : undefined,
              };
            }),
          };
        });

        await Invoice.insertMany(invoicesWithValidIds);
        console.log('[Database] MongoDB Atlas successfully seeded with starter data!');
      }
    } catch (seedErr) {
      console.warn('[Database] Seed check warning:', seedErr.message);
    }

    return true;
  } catch (error) {
    console.error(
      `[Database] MongoDB Atlas connection failed (${error.message}). Using persistent local store fallback.`
    );
    ensureSeedData();
    mongoConnected = false;
    return false;
  }
};

export const isMongoConnected = () => mongoConnected && mongoose.connection.readyState === 1;

// Persistent JSON-file store for seamless fallback when MongoDB Atlas URI is not yet provided
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const getDefaultSeedData = () => {
  const defaultUserId = 'user_shopkeeper_demo';
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const prevDate1 = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const prevY1 = prevDate1.getFullYear();
  const prevM1 = String(prevDate1.getMonth() + 1).padStart(2, '0');
  const prevDate2 = new Date(now.getFullYear(), now.getMonth() - 2, 18);
  const prevY2 = prevDate2.getFullYear();
  const prevM2 = String(prevDate2.getMonth() + 1).padStart(2, '0');

  return {
    businessProfiles: [
      {
        _id: 'bp_default_001',
        userId: defaultUserId,
        businessName: 'Sharma Electronics & Appliances',
        ownerName: 'Rajesh Sharma',
        shopAddress: 'Shop No. 14, MG Road Market, Indiranagar, Bengaluru, Karnataka - 560038',
        phone: '+91 98450 12345',
        email: 'billing@sharmaelectronics.in',
        gstin: '29ABCDE1234F1Z5',
        gstEnabled: true,
        defaultTaxRate: 18,
        currency: 'INR',
        currencySymbol: '₹',
        logoUrl: '',
        bankName: 'HDFC Bank, Indiranagar Branch',
        accountNumber: '50200048291044',
        ifscCode: 'HDFC0000184',
        upiId: 'sharmaelectronics@hdfcbank',
        invoicePrefix: 'INV',
        termsAndConditions:
          '1. Goods once sold will be exchanged only within 7 days with original bill.\n2. Warranty is covered directly by the respective brand service center.\n3. Subject to Bengaluru jurisdiction.',
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    customers: [
      {
        _id: 'cust_001',
        userId: defaultUserId,
        name: 'Ananya Verma',
        phone: '+91 98765 43210',
        email: 'ananya.verma@example.com',
        address: 'Flat 402, Palm Grove Apartments, Koramangala 4th Block, Bengaluru - 560034',
        gstin: '',
        notes: 'Regular retail customer - always pays via UPI',
        createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      {
        _id: 'cust_002',
        userId: defaultUserId,
        name: 'Kaveri Cafe & Bakers Pvt Ltd',
        phone: '+91 99001 55667',
        email: 'accounts@kavericafe.in',
        address: '88, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru - 560008',
        gstin: '29AABCK7788M1Z2',
        notes: 'B2B commercial kitchen equipment buyer',
        createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        _id: 'cust_003',
        userId: defaultUserId,
        name: 'Vikram Nair',
        phone: '+91 94480 78901',
        email: 'vikram.nair@example.com',
        address: '21, 5th Cross, Malleshwaram, Bengaluru - 560003',
        gstin: '',
        notes: 'Home office & lighting setup buyer',
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
      {
        _id: 'cust_004',
        userId: defaultUserId,
        name: 'Sunrise Residency Welfare Association',
        phone: '+91 98802 33445',
        email: 'facility@sunriseresidency.org',
        address: 'Tower B, Whitefield Main Road, Bengaluru - 560066',
        gstin: '29AAATS9911K1Z8',
        notes: 'Bulk corridor lighting & fan maintenance contract',
        createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
      {
        _id: 'cust_005',
        userId: defaultUserId,
        name: 'Meera Deshmukh',
        phone: '+91 97312 66543',
        email: 'meera.d@example.com',
        address: '14, Jayanagar 3rd Block, Bengaluru - 560011',
        gstin: '',
        notes: 'New walk-in customer inquiry',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    products: [
      {
        _id: 'prod_001',
        userId: defaultUserId,
        name: 'Crompton High-Speed Ceiling Fan 1200mm',
        sku: 'CR-FAN-1200',
        hsnCode: '841451',
        category: 'Electronics',
        description: 'Energy efficient 5-star rated ceiling fan with 2-year warranty (Pearl White)',
        price: 2450,
        taxRate: 18,
        unit: 'Nos',
        createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      },
      {
        _id: 'prod_002',
        userId: defaultUserId,
        name: 'Philips 9W LED Bulb Pack (Set of 4)',
        sku: 'PH-LED-9W4',
        hsnCode: '853950',
        category: 'Lighting',
        description: 'Cool Daylight 6500K B22 base energy saving LED bulbs',
        price: 380,
        taxRate: 12,
        unit: 'Pack',
        createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 86400000).toISOString(),
      },
      {
        _id: 'prod_003',
        userId: defaultUserId,
        name: 'Preethi Zodiac 750W Mixer Grinder',
        sku: 'PR-MIX-750',
        hsnCode: '850940',
        category: 'Kitchen Utility',
        description: 'Heavy duty 750W motor with 4 stainless steel jars and master chef jar',
        price: 6850,
        taxRate: 18,
        unit: 'Nos',
        createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 22 * 86400000).toISOString(),
      },
      {
        _id: 'prod_004',
        userId: defaultUserId,
        name: 'Havells 1.5L Stainless Steel Electric Kettle',
        sku: 'HV-KET-15L',
        hsnCode: '851679',
        category: 'Kitchen Utility',
        description: 'Double wall cool-touch electric kettle with auto shut-off',
        price: 1490,
        taxRate: 18,
        unit: 'Nos',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
      },
      {
        _id: 'prod_005',
        userId: defaultUserId,
        name: 'On-Site Appliance Installation & Wiring Service',
        sku: 'SRV-INST-01',
        hsnCode: '995461',
        category: 'Services',
        description: 'Standard technician visit, mounting, and testing charge',
        price: 450,
        taxRate: 18,
        unit: 'Service',
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      },
      {
        _id: 'prod_006',
        userId: defaultUserId,
        name: 'V-Guard Crystal Plus Voltage Stabilizer',
        sku: 'VG-STB-100',
        hsnCode: '903289',
        category: 'Electronics',
        description: 'Smart voltage stabilizer for LED TV and home theatre systems',
        price: 2150,
        taxRate: 18,
        unit: 'Nos',
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
    ],
    invoices: [
      {
        _id: 'inv_000',
        userId: defaultUserId,
        invoiceNumber: `INV-${prevY2}${prevM2}-001`,
        invoiceDate: `${prevY2}-${prevM2}-18`,
        dueDate: `${prevY2}-${prevM2}-25`,
        customerId: 'cust_004',
        customer: {
          name: 'Sunrise Residency Welfare Association',
          phone: '+91 98802 33445',
          email: 'facility@sunriseresidency.org',
          address: 'Tower B, Whitefield Main Road, Bengaluru - 560066',
          city: 'Bengaluru',
          country: 'India',
          gstin: '29AAATS9911K1Z8',
        },
        items: [
          {
            productId: 'prod_002',
            name: 'Philips 9W LED Bulb Pack (Set of 4)',
            description: 'Cool Daylight 6500K B22 base energy saving LED bulbs',
            hsnCode: '853950',
            quantity: 20,
            unitPrice: 380,
            discount: 400,
            taxRate: 12,
            lineSubtotal: 7600,
            lineNet: 7200,
            lineTax: 864,
            lineTotal: 8064,
          },
          {
            productId: 'prod_001',
            name: 'Crompton High-Speed Ceiling Fan 1200mm',
            description: 'Lobby fan replacement units',
            hsnCode: '841451',
            quantity: 4,
            unitPrice: 2450,
            discount: 300,
            taxRate: 18,
            lineSubtotal: 9800,
            lineNet: 9500,
            lineTax: 1710,
            lineTotal: 11210,
          },
        ],
        gstEnabled: true,
        subtotal: 17400,
        itemDiscountTotal: 700,
        invoiceDiscount: 0,
        taxAmount: 2574,
        additionalCharges: 0,
        previousDues: 0,
        grandTotal: 19274,
        amountPaid: 19274,
        balanceDue: 0,
        status: 'Paid',
        paymentMethod: 'Bank Transfer',
        notes: 'Paid in full via RTGS.',
        createdAt: `${prevY2}-${prevM2}-18T09:15:00.000Z`,
        updatedAt: `${prevY2}-${prevM2}-20T15:00:00.000Z`,
      },
      {
        _id: 'inv_001',
        userId: defaultUserId,
        invoiceNumber: `INV-${prevY1}${prevM1}-001`,
        invoiceDate: `${prevY1}-${prevM1}-12`,
        dueDate: `${prevY1}-${prevM1}-19`,
        customerId: 'cust_001',
        customer: {
          name: 'Ananya Verma',
          phone: '+91 98765 43210',
          email: 'ananya.verma@example.com',
          address: 'Flat 402, Palm Grove Apartments, Koramangala 4th Block, Bengaluru - 560034',
          city: 'Bengaluru',
          country: 'India',
          gstin: '',
        },
        items: [
          {
            productId: 'prod_001',
            name: 'Crompton High-Speed Ceiling Fan 1200mm',
            description: 'Energy efficient 5-star rated ceiling fan with 2-year warranty (Pearl White)',
            hsnCode: '841451',
            quantity: 2,
            unitPrice: 2450,
            discount: 200,
            taxRate: 18,
            lineSubtotal: 4900,
            lineNet: 4700,
            lineTax: 846,
            lineTotal: 5546,
          },
          {
            productId: 'prod_005',
            name: 'On-Site Appliance Installation & Wiring Service',
            description: 'Standard technician visit, mounting, and testing charge',
            hsnCode: '995461',
            quantity: 2,
            unitPrice: 450,
            discount: 0,
            taxRate: 18,
            lineSubtotal: 900,
            lineNet: 900,
            lineTax: 162,
            lineTotal: 1062,
          },
        ],
        gstEnabled: true,
        subtotal: 5800,
        itemDiscountTotal: 200,
        invoiceDiscount: 0,
        taxAmount: 1008,
        additionalCharges: 0,
        previousDues: 0,
        grandTotal: 6608,
        amountPaid: 6608,
        balanceDue: 0,
        status: 'Paid',
        paymentMethod: 'UPI',
        notes: 'Delivered and installed on same day.',
        createdAt: `${prevY1}-${prevM1}-12T10:30:00.000Z`,
        updatedAt: `${prevY1}-${prevM1}-12T14:15:00.000Z`,
      },
      {
        _id: 'inv_002',
        userId: defaultUserId,
        invoiceNumber: `INV-${y}${m}-001`,
        invoiceDate: `${y}-${m}-03`,
        dueDate: `${y}-${m}-17`,
        customerId: 'cust_002',
        customer: {
          name: 'Kaveri Cafe & Bakers Pvt Ltd',
          phone: '+91 99001 55667',
          email: 'accounts@kavericafe.in',
          address: '88, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru - 560008',
          city: 'Bengaluru',
          country: 'India',
          gstin: '29AABCK7788M1Z2',
        },
        items: [
          {
            productId: 'prod_003',
            name: 'Preethi Zodiac 750W Mixer Grinder',
            description: 'Heavy duty 750W motor with 4 stainless steel jars and master chef jar',
            hsnCode: '850940',
            quantity: 2,
            unitPrice: 6850,
            discount: 500,
            taxRate: 18,
            lineSubtotal: 13700,
            lineNet: 13200,
            lineTax: 2376,
            lineTotal: 15576,
          },
          {
            productId: 'prod_004',
            name: 'Havells 1.5L Stainless Steel Electric Kettle',
            description: 'Double wall cool-touch electric kettle with auto shut-off',
            hsnCode: '851679',
            quantity: 3,
            unitPrice: 1490,
            discount: 170,
            taxRate: 18,
            lineSubtotal: 4470,
            lineNet: 4300,
            lineTax: 774,
            lineTotal: 5074,
          },
        ],
        gstEnabled: true,
        subtotal: 18170,
        itemDiscountTotal: 670,
        invoiceDiscount: 0,
        taxAmount: 3150,
        additionalCharges: 150,
        previousDues: 0,
        grandTotal: 20800,
        amountPaid: 10000,
        balanceDue: 10800,
        status: 'Partially Paid',
        paymentMethod: 'Bank Transfer',
        notes: '50% advance received via NEFT. Balance due within 14 days.',
        createdAt: `${y}-${m}-03T11:20:00.000Z`,
        updatedAt: `${y}-${m}-03T11:20:00.000Z`,
      },
      {
        _id: 'inv_003',
        userId: defaultUserId,
        invoiceNumber: `INV-${y}${m}-002`,
        invoiceDate: `${y}-${m}-07`,
        dueDate: `${y}-${m}-14`,
        customerId: 'cust_003',
        customer: {
          name: 'Vikram Nair',
          phone: '+91 94480 78901',
          email: 'vikram.nair@example.com',
          address: '21, 5th Cross, Malleshwaram, Bengaluru - 560003',
          city: 'Bengaluru',
          country: 'India',
          gstin: '',
        },
        items: [
          {
            productId: 'prod_002',
            name: 'Philips 9W LED Bulb Pack (Set of 4)',
            description: 'Cool Daylight 6500K B22 base energy saving LED bulbs',
            hsnCode: '853950',
            quantity: 5,
            unitPrice: 380,
            discount: 0,
            taxRate: 12,
            lineSubtotal: 1900,
            lineNet: 1900,
            lineTax: 228,
            lineTotal: 2128,
          },
          {
            productId: 'prod_004',
            name: 'Havells 1.5L Stainless Steel Electric Kettle',
            description: 'Double wall cool-touch electric kettle with auto shut-off',
            hsnCode: '851679',
            quantity: 1,
            unitPrice: 1490,
            discount: 0,
            taxRate: 18,
            lineSubtotal: 1490,
            lineNet: 1490,
            lineTax: 268.2,
            lineTotal: 1758.2,
          },
        ],
        gstEnabled: true,
        subtotal: 3390,
        itemDiscountTotal: 0,
        invoiceDiscount: 50,
        taxAmount: 496.2,
        additionalCharges: 0,
        previousDues: 0,
        grandTotal: 3836.2,
        amountPaid: 0,
        balanceDue: 3836.2,
        status: 'Unpaid',
        paymentMethod: 'Cash',
        notes: 'Payment expected on delivery.',
        createdAt: `${y}-${m}-07T16:40:00.000Z`,
        updatedAt: `${y}-${m}-07T16:40:00.000Z`,
      },
      {
        _id: 'inv_004',
        userId: defaultUserId,
        invoiceNumber: `INV-${y}${m}-003`,
        invoiceDate: `${y}-${m}-09`,
        dueDate: `${y}-${m}-16`,
        customerId: 'cust_004',
        customer: {
          name: 'Sunrise Residency Welfare Association',
          phone: '+91 98802 33445',
          email: 'facility@sunriseresidency.org',
          address: 'Tower B, Whitefield Main Road, Bengaluru - 560066',
          city: 'Bengaluru',
          country: 'India',
          gstin: '29AAATS9911K1Z8',
        },
        items: [
          {
            productId: 'prod_006',
            name: 'V-Guard Crystal Plus Voltage Stabilizer',
            description: 'Smart voltage stabilizer for CCTV control room',
            hsnCode: '903289',
            quantity: 3,
            unitPrice: 2150,
            discount: 150,
            taxRate: 18,
            lineSubtotal: 6450,
            lineNet: 6300,
            lineTax: 1134,
            lineTotal: 7434,
          },
        ],
        gstEnabled: true,
        subtotal: 6450,
        itemDiscountTotal: 150,
        invoiceDiscount: 0,
        taxAmount: 1134,
        additionalCharges: 100,
        previousDues: 0,
        grandTotal: 7534,
        amountPaid: 0,
        balanceDue: 7534,
        status: 'Draft',
        paymentMethod: 'Bank Transfer',
        notes: 'Draft quotation awaiting committee approval.',
        createdAt: `${y}-${m}-09T12:10:00.000Z`,
        updatedAt: `${y}-${m}-09T12:10:00.000Z`,
      },
    ],
  };
};

export const ensureSeedData = () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify(getDefaultSeedData(), null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[Database] Could not initialize local store file:', err.message);
  }
};

export const readLocalStore = () => {
  ensureSeedData();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return getDefaultSeedData();
  }
};

export const writeLocalStore = (data) => {
  ensureSeedData();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Database] Failed writing local store:', err.message);
  }
};

export const generateLocalId = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
