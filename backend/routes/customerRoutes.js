import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateCustomerPayload } from '../validators/invoiceValidator.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', validateRequest(validateCustomerPayload), createCustomer);
router.put('/:id', validateRequest(validateCustomerPayload), updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
