import express from 'express';
import {
  getNextInvoiceNumber,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  downloadInvoicePDF,
} from '../controllers/invoiceController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateInvoicePayload } from '../validators/invoiceValidator.js';

const router = express.Router();

router.use(requireAuth);

router.get('/next-number', getNextInvoiceNumber);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.get('/:id/pdf', downloadInvoicePDF);
router.post('/', validateRequest(validateInvoicePayload), createInvoice);
router.put('/:id', validateRequest(validateInvoicePayload), updateInvoice);
router.patch('/:id/status', updateInvoiceStatus);
router.delete('/:id', deleteInvoice);

export default router;
