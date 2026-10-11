import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { isMongoConnected, readLocalStore } from '../config/db.js';
import { toPaise, toRupees } from '../utils/calculations.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const { userId } = req.auth;

    let invoices = [];
    let customerCount = 0;
    let productCount = 0;
    let productsMap = new Map();

    if (isMongoConnected()) {
      invoices = await Invoice.find({ userId }).sort({ invoiceDate: -1, createdAt: -1 }).lean();
      customerCount = await Customer.countDocuments({ userId });
      const products = await Product.find({ userId }).lean();
      productCount = products.length;
      products.forEach((p) => productsMap.set(String(p._id), p));
    } else {
      const store = readLocalStore();
      invoices = store.invoices
        .filter((inv) => inv.userId === userId)
        .sort((a, b) => String(b.invoiceDate).localeCompare(String(a.invoiceDate)));
      customerCount = store.customers.filter((c) => c.userId === userId).length;
      const products = store.products.filter((p) => p.userId === userId);
      productCount = products.length;
      products.forEach((p) => productsMap.set(String(p._id), p));
    }

    let totalSalesPaise = 0;
    let paidAmountPaise = 0;
    let pendingAmountPaise = 0;
    let totalTaxPaise = 0;

    const statusCounts = {
      Paid: 0,
      'Partially Paid': 0,
      Unpaid: 0,
      Draft: 0,
    };

    const statusAmountsPaise = {
      Paid: 0,
      'Partially Paid': 0,
      Unpaid: 0,
      Draft: 0,
    };

    const categoryTotalsPaise = {};

    invoices.forEach((inv) => {
      const status = statusCounts[inv.status] !== undefined ? inv.status : 'Unpaid';
      statusCounts[status] += 1;
      statusAmountsPaise[status] += toPaise(inv.grandTotal);

      if (inv.status !== 'Draft') {
        totalSalesPaise += toPaise(inv.grandTotal);
        paidAmountPaise += toPaise(inv.amountPaid);
        pendingAmountPaise += toPaise(inv.balanceDue);
        totalTaxPaise += toPaise(inv.taxAmount || 0);

        if (Array.isArray(inv.items)) {
          inv.items.forEach((item) => {
            const prod = productsMap.get(String(item.productId));
            const cat = prod?.category || 'General';
            categoryTotalsPaise[cat] = (categoryTotalsPaise[cat] || 0) + toPaise(item.lineTotal);
          });
        }
      }
    });

    // Build last 6 months series
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthlyMap = new Map();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthlyMap.set(ym, {
        yearMonth: ym,
        label,
        shortLabel: monthNames[d.getMonth()],
        totalSalesPaise: 0,
        paidPaise: 0,
        pendingPaise: 0,
        invoiceCount: 0,
      });
    }

    invoices.forEach((inv) => {
      if (inv.status === 'Draft') return;
      const ym = String(inv.invoiceDate || '').slice(0, 7);
      if (monthlyMap.has(ym)) {
        const bucket = monthlyMap.get(ym);
        bucket.totalSalesPaise += toPaise(inv.grandTotal);
        bucket.paidPaise += toPaise(inv.amountPaid);
        bucket.pendingPaise += toPaise(inv.balanceDue);
        bucket.invoiceCount += 1;
      }
    });

    const monthlySales = Array.from(monthlyMap.values()).map((m) => ({
      yearMonth: m.yearMonth,
      label: m.label,
      shortLabel: m.shortLabel,
      totalSales: toRupees(m.totalSalesPaise),
      paidAmount: toRupees(m.paidPaise),
      pendingAmount: toRupees(m.pendingPaise),
      invoiceCount: m.invoiceCount,
    }));

    const categoryBreakdown = Object.entries(categoryTotalsPaise).map(([category, paise]) => ({
      category,
      amount: toRupees(paise),
    }));

    return res.json({
      success: true,
      data: {
        summary: {
          totalInvoices: invoices.length,
          finalizedInvoices: invoices.filter((i) => i.status !== 'Draft').length,
          totalSales: toRupees(totalSalesPaise),
          paidAmount: toRupees(paidAmountPaise),
          pendingPayments: toRupees(pendingAmountPaise),
          totalTaxCollected: toRupees(totalTaxPaise),
          customerCount,
          productCount,
        },
        statusCounts,
        statusAmounts: {
          Paid: toRupees(statusAmountsPaise.Paid),
          'Partially Paid': toRupees(statusAmountsPaise['Partially Paid']),
          Unpaid: toRupees(statusAmountsPaise.Unpaid),
          Draft: toRupees(statusAmountsPaise.Draft),
        },
        categoryBreakdown,
        monthlySales,
        recentInvoices: invoices.slice(0, 8),
      },
    });
  } catch (err) {
    next(err);
  }
};
