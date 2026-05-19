import { Router } from 'express';
import { InsightsController } from '../controllers/InsightsController';

const router = Router();
router.get('/', InsightsController.mine);
router.get('/mine', InsightsController.mine);
router.get('/history', InsightsController.history);
router.get('/charts', InsightsController.charts);
export default router;
