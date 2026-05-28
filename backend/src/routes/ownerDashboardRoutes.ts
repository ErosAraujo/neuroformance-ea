import { Router } from 'express';
import { OwnerDashboardController } from '../controllers/OwnerDashboardController';

const router = Router();

router.post('/teachers', OwnerDashboardController.createTeacher);
router.get('/teachers-dashboard', OwnerDashboardController.teachersDashboard);

export default router;
