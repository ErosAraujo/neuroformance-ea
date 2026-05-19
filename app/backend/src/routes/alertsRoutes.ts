import { Router } from 'express';
import { AlertsController } from '../controllers/AlertsController';

const router = Router();

router.get('/mine', AlertsController.mine);
router.patch('/:id/resolve', AlertsController.resolve);
router.get('/', AlertsController.list);

export default router;