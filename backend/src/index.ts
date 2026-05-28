import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import sleepRecordRoutes from './routes/sleepRecordRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import studentsRoutes from './routes/studentsRoutes';
import alertsRoutes from './routes/alertsRoutes';
import sleepGoalRoutes from './routes/sleepGoalRoutes';
import insightsRoutes from './routes/insightsRoutes';
import observationRoutes from './routes/observationRoutes';
import teacherRoutes from './routes/teacherRoutes';
import indicatorRoutes from './routes/indicatorRoutes';
import pushRoutes from './routes/pushRoutes';
import ownerDashboardRoutes from './routes/ownerDashboardRoutes';
import { PushController } from './controllers/PushController';
import { authMiddleware } from './middleware/authMiddleware';
import { globalRateLimit, loginRateLimit } from './middleware/rateLimitMiddleware';
import { corsOrigin } from './config';
import prisma from './models/prisma';
import { startSleepReminderJob } from './services/pushReminderService';

const app = express();

// Cabeçalhos básicos de segurança sem dependências externas.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((item) => item.trim()), credentials: true }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));
app.use(globalRateLimit);
app.use('/api/auth/login', loginRateLimit);
app.post('/api/push/cron/run-due-reminders', PushController.runDueRemindersCron);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return res.json({ ok: true, database: 'connected', timestamp: new Date().toISOString(), uptime: process.uptime() });
  } catch (error: any) {
    return res.status(500).json({ ok: false, database: 'disconnected', message: error?.message || 'Erro ao conectar ao banco.' });
  }
});
app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return res.json({ ok: true, database: 'connected', timestamp: new Date().toISOString(), uptime: process.uptime() });
  } catch (error: any) {
    return res.status(500).json({ ok: false, database: 'disconnected', message: error?.message || 'Erro ao conectar ao banco.' });
  }
});
app.use('/api/auth', authRoutes);
app.use('/api', authMiddleware);
app.use('/api/sleep-records', sleepRecordRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/sleep-goals', sleepGoalRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/student/insights', insightsRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/owner', ownerDashboardRoutes);
app.use('/api/teacher', teacherRoutes);
// Nova rota para indicadores diários
app.use('/api/indicators', indicatorRoutes);
// Rotas de push (notificações)
app.use('/api/push', pushRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
  startSleepReminderJob();
});
