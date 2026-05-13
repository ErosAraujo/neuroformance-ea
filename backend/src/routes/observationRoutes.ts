import { Router } from 'express';
import { ObservationController } from '../controllers/ObservationController';

const router = Router();
router.post('/students/:studentId', ObservationController.store);
export default router;
