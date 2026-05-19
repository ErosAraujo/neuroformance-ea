import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId, getStudentIdByUserId } from '../services/identityService';

export class AlertsController {
  static async list(req: AuthRequest, res: Response) {
    try {
      if (req.user?.profile === 'teacher') {
        const teacherId = await getTeacherIdByUserId(req.user.id);
        const students = await prisma.student.findMany({ where: { teacherId, status: { not: 'deleted' } } });
        const alerts = await prisma.alert.findMany({
          where: { studentId: { in: students.map((s) => s.id) }, resolved: false },
          include: { student: { include: { user: true } } },
          orderBy: { date: 'desc' },
        });
        return res.json(alerts.map((a) => ({ id: a.id, studentId: a.studentId, studentName: a.student.user.name, type: a.type, title: a.type, message: a.description, description: a.description, level: a.level, severity: a.level, date: a.date, status: a.resolved ? 'Resolvido' : 'Ativo', source: 'database' })));
      }

      if (req.user?.profile === 'student') {
        const studentId = await getStudentIdByUserId(req.user.id);
        const alerts = await prisma.alert.findMany({ where: { studentId, resolved: false }, orderBy: { date: 'desc' } });
        return res.json(alerts.map((a) => ({ id: a.id, type: a.type, description: a.description, level: a.level, date: a.date, status: a.resolved ? 'Resolvido' : 'Ativo' })));
      }

      return res.status(403).json({ message: 'Perfil inválido.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao listar alertas.' });
    }
  }

  static async mine(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar seus alertas.' });
    try {
      const { getStudentIdByUserId } = await import('../services/identityService');
      const studentId = await getStudentIdByUserId(req.user.id);
      const alerts = await prisma.alert.findMany({ where: { studentId, resolved: false }, orderBy: { date: 'desc' } });
      return res.json(alerts);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao listar alertas do aluno.' });
    }
  }


  static async resolve(req: AuthRequest, res: Response) {
    const alertId = Number(req.params.id);
    if (!Number.isFinite(alertId)) return res.status(400).json({ message: 'ID de alerta inválido.' });

    try {
      if (req.user?.profile === 'teacher') {
        const teacherId = await getTeacherIdByUserId(req.user.id);
        const alert = await prisma.alert.findFirst({
          where: { id: alertId, student: { teacherId } },
        });
        if (!alert) return res.status(404).json({ message: 'Alerta não encontrado para este professor.' });
        const resolved = await prisma.alert.update({ where: { id: alertId }, data: { resolved: true, resolvedAt: new Date() } });
        return res.json(resolved);
      }

      if (req.user?.profile === 'student') {
        const studentId = await getStudentIdByUserId(req.user.id);
        const alert = await prisma.alert.findFirst({ where: { id: alertId, studentId } });
        if (!alert) return res.status(404).json({ message: 'Alerta não encontrado para este aluno.' });
        const resolved = await prisma.alert.update({ where: { id: alertId }, data: { resolved: true, resolvedAt: new Date() } });
        return res.json(resolved);
      }

      return res.status(403).json({ message: 'Perfil inválido.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao resolver alerta.' });
    }
  }

}
