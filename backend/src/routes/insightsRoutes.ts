import { Router } from 'express';
import { InsightsController } from '../controllers/InsightsController';

const router = Router();
router.get('/mine', InsightsController.mine);
export default router;
