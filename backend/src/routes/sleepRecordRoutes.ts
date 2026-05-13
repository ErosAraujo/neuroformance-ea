import { Router } from 'express';
import { SleepRecordController } from '../controllers/SleepRecordController';

const router = Router();

router.get('/', SleepRecordController.index);
router.get('/last', SleepRecordController.last);
router.get('/weekly-summary', SleepRecordController.weeklySummary);
router.get('/recovery-summary', SleepRecordController.recoverySummary);
router.get('/:id', SleepRecordController.show);
router.post('/', SleepRecordController.store);
router.put('/:id', SleepRecordController.update);

export default router;
