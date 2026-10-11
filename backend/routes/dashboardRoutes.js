import express from 'express';
import { getDashboardSummary } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getDashboardSummary);

export default router;
