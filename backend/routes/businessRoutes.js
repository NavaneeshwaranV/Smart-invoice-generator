import express from 'express';
import { getBusinessProfile, updateBusinessProfile } from '../controllers/businessController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateBusinessProfilePayload } from '../validators/invoiceValidator.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getBusinessProfile);
router.put('/', validateRequest(validateBusinessProfilePayload), updateBusinessProfile);

export default router;
