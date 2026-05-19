import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId } from '../services/identityService';
import { buildTeacherDashboardSummary } from '../services/teacherDashboardService';

export class DashboardController {
  static async overview(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') {
      return res.status(403).json({ message: 'Apenas professores podem acessar o dashboard.' });
    }

    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const students = await prisma.student.findMany({
        where: { teacherId, status: 'active' },
        include: {
          user: true,
          sleepRecords: { orderBy: { date: 'desc' } },
          sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      const normalizedStudents = students.map((student) => ({
        ...student,
        activeSleepGoal: student.sleepGoals[0] ?? null,
      }));

      return res.json(buildTeacherDashboardSummary(normalizedStudents));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar dashboard.' });
    }
  }
}
