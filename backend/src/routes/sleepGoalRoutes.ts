import { Router } from 'express';
import { SleepGoalController } from '../controllers/SleepGoalController';

const router = Router();
router.get('/active', SleepGoalController.active);
router.post('/', SleepGoalController.upsert);
router.get('/student/:studentId/active', SleepGoalController.activeByStudent);
router.post('/student/:studentId', SleepGoalController.upsertByStudent);
export default router;
