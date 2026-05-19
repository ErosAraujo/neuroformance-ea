import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId, getTeacherIdByUserId } from '../services/identityService';
import { parseClockOnDate } from '../services/timeService';

function validateGoal(hoursGoal: number, regularityGoal: number) {
  if (!Number.isFinite(hoursGoal) || hoursGoal < 4 || hoursGoal > 12) {
    throw new Error('Meta mínima de horas deve ficar entre 4 e 12 horas.');
  }
  if (!Number.isFinite(regularityGoal) || regularityGoal < 15 || regularityGoal > 180) {
    throw new Error('Meta de regularidade deve ficar entre 15 e 180 minutos.');
  }
}

export class SleepGoalController {
  static async active(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar metas.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const goal = await prisma.sleepGoal.findFirst({ where: { studentId, active: true }, orderBy: { createdAt: 'desc' } });
      return res.json(goal);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar meta de sono.' });
    }
  }

  static async activeByStudent(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') return res.status(403).json({ message: 'Apenas professores podem acessar metas dos alunos.' });
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const studentId = Number(req.params.studentId);
      if (!Number.isFinite(studentId)) return res.status(400).json({ message: 'Aluno inválido.' });
      const student = await prisma.student.findFirst({ where: { id: studentId, status: { not: 'deleted' } } });
      if (!student || student.teacherId !== teacherId) return res.status(404).json({ message: 'Aluno não encontrado.' });
      const goal = await prisma.sleepGoal.findFirst({ where: { studentId, active: true }, orderBy: { createdAt: 'desc' } });
      return res.json(goal);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar meta de sono do aluno.' });
    }
  }

  static async upsertByStudent(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') return res.status(403).json({ message: 'Apenas professores podem salvar metas dos alunos.' });
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const studentId = Number(req.params.studentId);
      if (!Number.isFinite(studentId)) return res.status(400).json({ message: 'Aluno inválido.' });
      const student = await prisma.student.findFirst({ where: { id: studentId, status: { not: 'deleted' } } });
      if (!student || student.teacherId !== teacherId) return res.status(404).json({ message: 'Aluno não encontrado.' });
      const { hoursGoal, sleepTimeGoal, wakeTimeGoal, regularityGoal } = req.body;
      const hours = Number(hoursGoal);
      const regularity = Number(regularityGoal);
      validateGoal(hours, regularity);
      const baseDate = '1970-01-01';
      const sleepTarget = parseClockOnDate(baseDate, sleepTimeGoal);
      const wakeTarget = parseClockOnDate(baseDate, wakeTimeGoal);
      const goal = await prisma.$transaction(async (tx) => {
        await tx.sleepGoal.updateMany({ where: { studentId, active: true }, data: { active: false } });
        return tx.sleepGoal.create({
          data: { studentId, hoursGoal: hours, sleepTimeGoal: sleepTarget, wakeTimeGoal: wakeTarget, regularityGoal: regularity, active: true },
        });
      });
      return res.status(201).json(goal);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ message: error.message || 'Erro ao salvar meta de sono do aluno.' });
    }
  }

  static async upsert(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem salvar metas.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const { hoursGoal, sleepTimeGoal, wakeTimeGoal, regularityGoal } = req.body;
      const hours = Number(hoursGoal);
      const regularity = Number(regularityGoal);
      validateGoal(hours, regularity);
      const baseDate = '1970-01-01';
      const sleepTarget = parseClockOnDate(baseDate, sleepTimeGoal);
      const wakeTarget = parseClockOnDate(baseDate, wakeTimeGoal);

      const goal = await prisma.$transaction(async (tx) => {
        await tx.sleepGoal.updateMany({ where: { studentId, active: true }, data: { active: false } });
        return tx.sleepGoal.create({
          data: { studentId, hoursGoal: hours, sleepTimeGoal: sleepTarget, wakeTimeGoal: wakeTarget, regularityGoal: regularity, active: true },
        });
      });
      return res.status(201).json(goal);
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ message: error.message || 'Erro ao salvar meta de sono.' });
    }
  }
}
