import Product from '../models/Product.js';
import { isMongoConnected, readLocalStore, writeLocalStore, generateLocalId } from '../config/db.js';

export const getProducts = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { search = '', category = '' } = req.query;

    if (isMongoConnected()) {
      const filter = { userId };
      if (category && category !== 'All') {
        filter.category = category;
      }
      if (search && String(search).trim()) {
        const q = String(search).trim();
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { sku: { $regex: q, $options: 'i' } },
          { hsnCode: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ];
      }
      const products = await Product.find(filter).sort({ name: 1 }).lean();
      return res.json({ success: true, count: products.length, data: products });
    }

    const store = readLocalStore();
    let products = store.products.filter((p) => p.userId === userId);

    if (category && category !== 'All') {
      products = products.filter((p) => (p.category || 'General') === category);
    }

    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      products = products.filter(
        (p) =>
          String(p.name || '')
            .toLowerCase()
            .includes(q) ||
          String(p.sku || '')
            .toLowerCase()
            .includes(q) ||
          String(p.hsnCode || '')
            .toLowerCase()
            .includes(q) ||
          String(p.description || '')
            .toLowerCase()
            .includes(q)
      );
    }

    products.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return res.json({ success: true, count: products.length, data: products });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const payload = {
      userId,
      name: String(req.body.name || '').trim(),
      sku: String(req.body.sku || '').trim().toUpperCase(),
      hsnCode: String(req.body.hsnCode || '').trim(),
      category: String(req.body.category || 'General').trim(),
      description: String(req.body.description || '').trim(),
      price: Number(req.body.price || 0),
      taxRate: Number(req.body.taxRate ?? 18),
      unit: String(req.body.unit || 'Nos').trim(),
    };

    if (isMongoConnected()) {
      const created = await Product.create(payload);
      return res.status(201).json({
        success: true,
        message: 'Product added to catalog.',
        data: created,
      });
    }

    const store = readLocalStore();
    const newProduct = {
      _id: generateLocalId('prod'),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.products.push(newProduct);
    writeLocalStore(store);

    return res.status(201).json({
      success: true,
      message: 'Product added to catalog.',
      data: newProduct,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const updates = {
      name: String(req.body.name || '').trim(),
      sku: String(req.body.sku || '').trim().toUpperCase(),
      hsnCode: String(req.body.hsnCode || '').trim(),
      category: String(req.body.category || 'General').trim(),
      description: String(req.body.description || '').trim(),
      price: Number(req.body.price || 0),
      taxRate: Number(req.body.taxRate ?? 18),
      unit: String(req.body.unit || 'Nos').trim(),
    };

    if (isMongoConnected()) {
      const updated = await Product.findOneAndUpdate(
        { _id: id, userId },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.json({
        success: true,
        message: 'Product updated successfully.',
        data: updated,
      });
    }

    const store = readLocalStore();
    const idx = store.products.findIndex((p) => p._id === id && p.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    store.products[idx] = {
      ...store.products[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeLocalStore(store);

    return res.json({
      success: true,
      message: 'Product updated successfully.',
      data: store.products[idx],
    });
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    if (isMongoConnected()) {
      const deleted = await Product.findOneAndDelete({ _id: id, userId }).lean();
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.json({
        success: true,
        message: 'Product deleted from catalog.',
      });
    }

    const store = readLocalStore();
    const idx = store.products.findIndex((p) => p._id === id && p.userId === userId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    store.products.splice(idx, 1);
    writeLocalStore(store);

    return res.json({
      success: true,
      message: 'Product deleted from catalog.',
    });
  } catch (err) {
    next(err);
  }
};
