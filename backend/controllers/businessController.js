import BusinessProfile from '../models/BusinessProfile.js';
import { isMongoConnected, readLocalStore, writeLocalStore, generateLocalId } from '../config/db.js';

export const getBusinessProfile = async (req, res, next) => {
  try {
    const { userId } = req.auth;

    if (isMongoConnected()) {
      let profile = await BusinessProfile.findOne({ userId }).lean();
      if (!profile) {
        profile = await BusinessProfile.create({
          userId,
          businessName: req.auth.name ? `${req.auth.name} Store` : 'Sharma Electronics & Appliances',
          ownerName: req.auth.name || 'Rajesh Sharma',
          email: req.auth.email || 'billing@sharmaelectronics.in',
          currency: 'INR',
          currencySymbol: '₹',
          gstEnabled: true,
          defaultTaxRate: 18,
          invoicePrefix: 'INV',
        });
      }
      return res.json({ success: true, data: profile });
    }

    const store = readLocalStore();
    let profile = store.businessProfiles.find((b) => b.userId === userId);
    if (!profile) {
      profile = {
        _id: generateLocalId('bp'),
        userId,
        businessName: req.auth.name ? `${req.auth.name} Enterprises` : 'Sharma Electronics & Appliances',
        ownerName: req.auth.name || 'Rajesh Sharma',
        shopAddress: 'Shop No. 14, MG Road Market, Indiranagar, Bengaluru, Karnataka - 560038',
        phone: '+91 98450 12345',
        email: req.auth.email || 'billing@sharmaelectronics.in',
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
          '1. Goods once sold will be exchanged only within 7 days with original bill.\n2. Subject to local jurisdiction.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.businessProfiles.push(profile);
      writeLocalStore(store);
    }

    return res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

export const updateBusinessProfile = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const updates = {
      businessName: String(req.body.businessName || '').trim(),
      ownerName: String(req.body.ownerName || '').trim(),
      shopAddress: String(req.body.shopAddress || '').trim(),
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase(),
      gstin: String(req.body.gstin || '').trim().toUpperCase(),
      gstEnabled: req.body.gstEnabled !== undefined ? Boolean(req.body.gstEnabled) : true,
      defaultTaxRate: Number(req.body.defaultTaxRate ?? 18),
      currency: String(req.body.currency || 'INR').trim().toUpperCase(),
      currencySymbol: String(req.body.currencySymbol || '₹').trim(),
      logoUrl: String(req.body.logoUrl || '').trim(),
      bankName: String(req.body.bankName || '').trim(),
      accountNumber: String(req.body.accountNumber || '').trim(),
      ifscCode: String(req.body.ifscCode || '').trim().toUpperCase(),
      upiId: String(req.body.upiId || '').trim(),
      invoicePrefix: String(req.body.invoicePrefix || 'INV').trim().toUpperCase(),
      termsAndConditions: String(req.body.termsAndConditions || '').trim(),
    };

    if (isMongoConnected()) {
      const profile = await BusinessProfile.findOneAndUpdate(
        { userId },
        { $set: { ...updates, userId } },
        { new: true, upsert: true, runValidators: true }
      ).lean();
      return res.json({
        success: true,
        message: 'Business profile saved successfully.',
        data: profile,
      });
    }

    const store = readLocalStore();
    const idx = store.businessProfiles.findIndex((b) => b.userId === userId);
    let saved;
    if (idx >= 0) {
      saved = {
        ...store.businessProfiles[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      store.businessProfiles[idx] = saved;
    } else {
      saved = {
        _id: generateLocalId('bp'),
        userId,
        ...updates,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.businessProfiles.push(saved);
    }
    writeLocalStore(store);

    return res.json({
      success: true,
      message: 'Business profile saved successfully.',
      data: saved,
    });
  } catch (err) {
    next(err);
  }
};
