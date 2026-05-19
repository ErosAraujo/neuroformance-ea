import { Router } from 'express';
import { TeacherController } from '../controllers/TeacherController';

const router = Router();

router.get('/dashboard-summary', TeacherController.dashboardSummary);
router.get('/alerts', TeacherController.alerts);
router.get('/students/:studentId/insights', TeacherController.studentInsights);
router.get('/students/:studentId/alerts', TeacherController.studentAlerts);
router.get('/students/:studentId/sleep-records', TeacherController.studentSleepRecords);
router.get('/students/:studentId/sleep-records/:recordId', TeacherController.studentSleepRecord);

export default router;
