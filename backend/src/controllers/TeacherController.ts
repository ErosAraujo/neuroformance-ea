import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId } from '../services/identityService';
import { buildTeacherDashboardSummary, mapSleepRecordForTeacher } from '../services/teacherDashboardService';
import { buildTeacherAlertsForStudent, buildTeacherStudentProfile } from '../services/insightService';

function isTeacherOrAdmin(req: AuthRequest): boolean {
  return req.user?.profile === 'teacher' || req.user?.profile === 'admin';
}

export class TeacherController {
  static async dashboardSummary(req: AuthRequest, res: Response) {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ message: 'Apenas professores podem acessar o resumo consolidado.' });
    }

    try {
      const teacherId = req.user?.profile === 'teacher' ? await getTeacherIdByUserId(req.user.id) : undefined;
      const students = await prisma.student.findMany({
        where: { status: 'active', ...(teacherId ? { teacherId } : {}) },
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
      return res.status(500).json({ message: 'Erro ao gerar resumo consolidado do professor.' });
    }
  }

  static async studentSleepRecords(req: AuthRequest, res: Response) {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ message: 'Apenas professores podem acessar registros completos dos alunos.' });
    }

    const studentId = Number(req.params.studentId);
    if (!Number.isFinite(studentId)) return res.status(400).json({ message: 'Aluno inválido.' });

    try {
      const teacherId = req.user?.profile === 'teacher' ? await getTeacherIdByUserId(req.user.id) : undefined;
      const student = await prisma.student.findFirst({ where: { id: studentId, status: { not: 'deleted' }, ...(teacherId ? { teacherId } : {}) } });
      if (!student) return res.status(404).json({ message: 'Aluno não encontrado.' });

      const records = await prisma.sleepRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' } });
      return res.json(records.map(mapSleepRecordForTeacher));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar registros completos do aluno.' });
    }
  }

  static async studentSleepRecord(req: AuthRequest, res: Response) {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ message: 'Apenas professores podem acessar registros completos dos alunos.' });
    }

    const studentId = Number(req.params.studentId);
    const recordId = Number(req.params.recordId);
    if (!Number.isFinite(studentId)) return res.status(400).json({ message: 'Aluno inválido.' });
    if (!Number.isFinite(recordId)) return res.status(400).json({ message: 'Registro inválido.' });

    try {
      const teacherId = req.user?.profile === 'teacher' ? await getTeacherIdByUserId(req.user.id) : undefined;
      const student = await prisma.student.findFirst({ where: { id: studentId, status: { not: 'deleted' }, ...(teacherId ? { teacherId } : {}) } });
      if (!student) return res.status(404).json({ message: 'Aluno não encontrado.' });

      const record = await prisma.sleepRecord.findFirst({ where: { id: recordId, studentId } });
      if (!record) return res.status(404).json({ message: 'Registro não encontrado.' });
      return res.json(mapSleepRecordForTeacher(record));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar registro completo do aluno.' });
    }
  }

  static async alerts(req: AuthRequest, res: Response) {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ message: 'Apenas professores podem acessar alertas.' });
    }

    try {
      const teacherId = req.user?.profile === 'teacher' ? await getTeacherIdByUserId(req.user.id) : undefined;
      const students = await prisma.student.findMany({
        where: { status: 'active', ...(teacherId ? { teacherId } : {}) },
        include: {
          user: true,
          sleepRecords: { orderBy: { date: 'desc' } },
          sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      const groupedByStudent = students.map((student) => {
        const alerts = buildTeacherAlertsForStudent(student.id, student.user.name, student.sleepRecords, student.sleepGoals[0] ?? null);
        return {
          studentId: student.id,
          studentName: student.user.name,
          studentEmail: student.user.email,
          studentPhotoUrl: student.user.photoUrl ?? null,
          lastRecord: mapSleepRecordForTeacher(student.sleepRecords[0]),
          priority: alerts[0]?.priority ?? 'low',
          alerts,
          recommendedAction: alerts[0]?.recommendedAction ?? 'Sem ação imediata. Manter acompanhamento.',
        };
      }).filter((group) => group.alerts.length > 0)
        .sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3 }[a.priority as 'critical' | 'high' | 'medium' | 'low'] - { critical: 0, high: 1, medium: 2, low: 3 }[b.priority as 'critical' | 'high' | 'medium' | 'low']));

      return res.json({
        totalStudentsWithAlerts: groupedByStudent.length,
        totalAlerts: groupedByStudent.reduce((sum, group) => sum + group.alerts.length, 0),
        groupedByStudent,
        alerts: groupedByStudent.flatMap((group) => group.alerts),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar alertas do professor.' });
    }
  }

  static async studentInsights(req: AuthRequest, res: Response) {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ message: 'Apenas professores podem acessar ficha de aluno.' });
    }

    const studentId = Number(req.params.studentId);
    if (!Number.isFinite(studentId)) return res.status(400).json({ message: 'Aluno inválido.' });

    try {
      const teacherId = req.user?.profile === 'teacher' ? await getTeacherIdByUserId(req.user.id) : undefined;
      const student = await prisma.student.findFirst({
        where: { id: studentId, status: { not: 'deleted' }, ...(teacherId ? { teacherId } : {}) },
        include: {
          user: true,
          sleepRecords: { orderBy: { date: 'desc' } },
          sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!student) return res.status(404).json({ message: 'Aluno não encontrado.' });
      return res.json(buildTeacherStudentProfile(student.id, student.user.name, student.sleepRecords, student.sleepGoals[0] ?? null));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar ficha inteligente do aluno.' });
    }
  }

  static async studentAlerts(req: AuthRequest, res: Response) {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ message: 'Apenas professores podem acessar alertas do aluno.' });
    }

    const studentId = Number(req.params.studentId);
    if (!Number.isFinite(studentId)) return res.status(400).json({ message: 'Aluno inválido.' });

    try {
      const teacherId = req.user?.profile === 'teacher' ? await getTeacherIdByUserId(req.user.id) : undefined;
      const student = await prisma.student.findFirst({
        where: { id: studentId, status: { not: 'deleted' }, ...(teacherId ? { teacherId } : {}) },
        include: {
          user: true,
          sleepRecords: { orderBy: { date: 'desc' } },
          sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!student) return res.status(404).json({ message: 'Aluno não encontrado.' });
      return res.json({ alerts: buildTeacherAlertsForStudent(student.id, student.user.name, student.sleepRecords, student.sleepGoals[0] ?? null) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar alertas do aluno.' });
    }
  }

}
