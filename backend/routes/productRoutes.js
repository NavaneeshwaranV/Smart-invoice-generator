import express from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { validateProductPayload } from '../validators/invoiceValidator.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getProducts);
router.post('/', validateRequest(validateProductPayload), createProduct);
router.put('/:id', validateRequest(validateProductPayload), updateProduct);
router.delete('/:id', deleteProduct);

export default router;
