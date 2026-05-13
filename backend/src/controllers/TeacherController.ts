import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId } from '../services/identityService';
import { buildTeacherDashboardSummary, mapSleepRecordForTeacher } from '../services/teacherDashboardService';

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
}
