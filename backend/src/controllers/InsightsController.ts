import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';
import { buildSleepInsights } from '../services/insightService';
import { getRollingLast7DaysRange } from '../services/timeService';

export class InsightsController {
  static async mine(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar insights.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const { start, end, previousStart, previousEnd } = getRollingLast7DaysRange();
      const currentWeek = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } });
      const previousWeek = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: previousStart, lte: previousEnd } }, orderBy: { date: 'asc' } });
      return res.json(buildSleepInsights(currentWeek, previousWeek));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar insights.' });
    }
  }
}
