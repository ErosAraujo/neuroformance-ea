import { Router } from 'express';
import { PushController } from '../controllers/PushController';

const router = Router();

router.get('/public-key', PushController.publicKey);
router.get('/settings', PushController.settings);

router.post('/subscribe', PushController.subscribe);
router.post('/unsubscribe', PushController.unsubscribe);
router.patch('/settings', PushController.updateSettings);

router.post('/test', PushController.testPush);
router.post('/run-due-reminders', PushController.runDueReminders);

export default router;
