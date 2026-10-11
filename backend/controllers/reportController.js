import Invoice from '../models/Invoice.js';
import Product from '../models/Product.js';
import { isMongoConnected, readLocalStore } from '../config/db.js';
import { toPaise, toRupees } from '../utils/calculations.js';

export const getSalesReport = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { startDate = '', endDate = '' } = req.query;

    let invoices = [];
    let productsMap = new Map();

    if (isMongoConnected()) {
      const filter = { userId, status: { $ne: 'Draft' } };
      if (startDate || endDate) {
        filter.invoiceDate = {};
        if (startDate) filter.invoiceDate.$gte = String(startDate).trim();
        if (endDate) filter.invoiceDate.$lte = String(endDate).trim();
      }
      invoices = await Invoice.find(filter).sort({ invoiceDate: -1 }).lean();
      const products = await Product.find({ userId }).lean();
      products.forEach((p) => productsMap.set(String(p._id), p));
    } else {
      const store = readLocalStore();
      invoices = store.invoices
        .filter((inv) => inv.userId === userId && inv.status !== 'Draft')
        .filter((inv) => {
          const d = String(inv.invoiceDate || '');
          if (startDate && d < String(startDate).trim()) return false;
          if (endDate && d > String(endDate).trim()) return false;
          return true;
        })
        .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
      store.products
        .filter((p) => p.userId === userId)
        .forEach((p) => productsMap.set(String(p._id), p));
    }

    let totalRevenuePaise = 0;
    let totalCollectedPaise = 0;
    let totalPendingPaise = 0;
    let totalTaxPaise = 0;
    let totalDiscountPaise = 0;

    const monthlyGroup = {};
    const productRanking = {};
    const categorySales = {};
    const paymentMethodSales = {};

    invoices.forEach((inv) => {
      const grandPaise = toPaise(inv.grandTotal);
      const paidPaise = toPaise(inv.amountPaid);
      const balancePaise = toPaise(inv.balanceDue);
      const taxPaise = toPaise(inv.taxAmount || 0);
      const discPaise = toPaise(inv.itemDiscountTotal || 0) + toPaise(inv.invoiceDiscount || 0);

      totalRevenuePaise += grandPaise;
      totalCollectedPaise += paidPaise;
      totalPendingPaise += balancePaise;
      totalTaxPaise += taxPaise;
      totalDiscountPaise += discPaise;

      const ym = String(inv.invoiceDate || '').slice(0, 7) || 'Unknown';
      if (!monthlyGroup[ym]) {
        monthlyGroup[ym] = {
          yearMonth: ym,
          invoiceCount: 0,
          revenuePaise: 0,
          collectedPaise: 0,
          pendingPaise: 0,
          taxPaise: 0,
        };
      }
      monthlyGroup[ym].invoiceCount += 1;
      monthlyGroup[ym].revenuePaise += grandPaise;
      monthlyGroup[ym].collectedPaise += paidPaise;
      monthlyGroup[ym].pendingPaise += balancePaise;
      monthlyGroup[ym].taxPaise += taxPaise;

      const pm = inv.paymentMethod || 'UPI';
      paymentMethodSales[pm] = (paymentMethodSales[pm] || 0) + grandPaise;

      if (Array.isArray(inv.items)) {
        inv.items.forEach((item) => {
          const key = item.name || 'Unnamed Product';
          if (!productRanking[key]) {
            productRanking[key] = {
              name: key,
              quantitySold: 0,
              revenuePaise: 0,
            };
          }
          productRanking[key].quantitySold += Number(item.quantity || 0);
          productRanking[key].revenuePaise += toPaise(item.lineTotal);

          const prod = productsMap.get(String(item.productId));
          const cat = prod?.category || 'General';
          categorySales[cat] = (categorySales[cat] || 0) + toPaise(item.lineTotal);
        });
      }
    });

    const monthlyBreakdown = Object.values(monthlyGroup)
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
      .map((m) => ({
        yearMonth: m.yearMonth,
        invoiceCount: m.invoiceCount,
        revenue: toRupees(m.revenuePaise),
        collected: toRupees(m.collectedPaise),
        pending: toRupees(m.pendingPaise),
        tax: toRupees(m.taxPaise),
      }));

    const topProducts = Object.values(productRanking)
      .sort((a, b) => b.revenuePaise - a.revenuePaise)
      .slice(0, 8)
      .map((p) => ({
        name: p.name,
        quantitySold: p.quantitySold,
        revenue: toRupees(p.revenuePaise),
      }));

    const categoryBreakdown = Object.entries(categorySales).map(([category, paise]) => ({
      category,
      amount: toRupees(paise),
    }));

    return res.json({
      success: true,
      data: {
        summary: {
          invoiceCount: invoices.length,
          totalRevenue: toRupees(totalRevenuePaise),
          totalCollected: toRupees(totalCollectedPaise),
          totalPending: toRupees(totalPendingPaise),
          totalTax: toRupees(totalTaxPaise),
          totalDiscount: toRupees(totalDiscountPaise),
        },
        monthlyBreakdown,
        topProducts,
        categoryBreakdown,
        invoices,
      },
    });
  } catch (err) {
    next(err);
  }
};
