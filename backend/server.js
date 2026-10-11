import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB, isMongoConnected } from './config/db.js';
import businessRoutes from './routes/businessRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import productRoutes from './routes/productRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { issueLocalSessionToken } from './middleware/requireAuth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = async () => {
  await connectDB();

  const app = express();

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS configuration
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  app.use(
    cors({
      origin: allowedOrigin === '*' ? true : allowedOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );

  // Body parsers (5MB limit to support shop logo data URLs)
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Rate limiting for API endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    },
  });
  app.use('/api', apiLimiter);

  // Public runtime config route (never exposes secrets)
  app.get('/api/config/public', (req, res) => {
    const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY || '';
    const isClerkConfigured =
      clerkPubKey.startsWith('pk_test_') || clerkPubKey.startsWith('pk_live_');
    res.json({
      success: true,
      clerkPublishableKey: isClerkConfigured ? clerkPubKey : '',
      isClerkConfigured,
      databaseMode: isMongoConnected() ? 'mongodb_atlas' : 'persistent_json_store',
    });
  });

  // Session token endpoint for Clerk-compatible sandbox authentication
  app.post('/api/auth/session', (req, res) => {
    const email = String(req.body.email || 'billing@sharmaelectronics.in')
      .trim()
      .toLowerCase();
    const name = String(req.body.name || 'Rajesh Sharma').trim();
    const userId =
      req.body.userId ||
      (email === 'billing@sharmaelectronics.in'
        ? 'user_shopkeeper_demo'
        : `user_${Buffer.from(email).toString('hex').slice(0, 16)}`);

    const token = issueLocalSessionToken({ userId, email, name });
    res.json({
      success: true,
      token,
      user: {
        userId,
        email,
        name,
      },
    });
  });

  // Protected REST API Routes
  app.use('/api/business', businessRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);

  // Serve Frontend Static Assets (HTML5, CSS3, Bootstrap 5, Vanilla JS)
  const frontendDir = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendDir));

  // Clean URL support for multi-page HTML routes
  const pages = [
    'index',
    'dashboard',
    'create-invoice',
    'invoices',
    'customers',
    'products',
    'reports',
    'settings',
  ];
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'dashboard.html'));
  });

  pages.forEach((page) => {
    app.get(`/${page}`, (req, res) => {
      res.sendFile(path.join(frontendDir, `${page}.html`));
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
};

// Start server if executed directly (e.g., `node backend/server.js`)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const PORT = Number(process.env.PORT) || 3000;
  createApp().then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Smart Invoice Generator server running on http://localhost:${PORT}`);
    });
  });
}
