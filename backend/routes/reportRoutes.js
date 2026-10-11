import express from 'express';
import { getSalesReport } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getSalesReport);

export default router;
