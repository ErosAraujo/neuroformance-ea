import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId } from '../services/identityService';
import { buildOwnerTeachersDashboard } from '../services/ownerDashboardService';

const OWNER_TEACHER_ID = Number(process.env.OWNER_TEACHER_ID || 1);

async function assertOwnerAccess(req: AuthRequest) {
  if (req.user?.profile === 'admin') return { profile: 'admin' as const, teacherId: null };
  if (req.user?.profile !== 'teacher') throw new Error('Acesso restrito ao criador.');
  const teacherId = await getTeacherIdByUserId(req.user.id);
  if (teacherId !== OWNER_TEACHER_ID) throw new Error('Acesso restrito ao criador.');
  return { profile: 'teacher' as const, teacherId };
}

export class OwnerDashboardController {
  static async createTeacher(req: AuthRequest, res: Response) {
    try {
      await assertOwnerAccess(req);

      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (name.length < 2) return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'E-mail invalido.' });
      if (password.length < 6) return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres.' });

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ message: 'E-mail ja registrado.' });

      const hashed = await bcrypt.hash(password, 10);
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashed,
            profile: 'teacher',
          },
        });
        const teacher = await tx.teacher.create({ data: { userId: user.id } });
        return { user, teacher };
      });

      return res.status(201).json({
        ok: true,
        teacher: {
          teacherId: result.teacher.id,
          userId: result.user.id,
          name: result.user.name,
          email: result.user.email,
          teacherCode: String(result.teacher.id),
          active: result.user.active,
          createdAt: result.user.createdAt,
        },
      });
    } catch (error: any) {
      const status = error.message === 'Acesso restrito ao criador.' ? 403 : 500;
      if (status === 500) console.error(error);
      return res.status(status).json({ message: error.message || 'Erro ao criar professor.' });
    }
  }

  static async teachersDashboard(req: AuthRequest, res: Response) {
    try {
      const access = await assertOwnerAccess(req);
      const teachers = await prisma.teacher.findMany({
        include: {
          user: true,
          students: {
            include: {
              user: true,
              sleepRecords: { orderBy: { date: 'desc' } },
              sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { id: 'asc' },
      });

      const normalizedTeachers = teachers.map((teacher) => ({
        ...teacher,
        students: teacher.students.map((student) => ({
          ...student,
          activeSleepGoal: student.sleepGoals[0] ?? null,
        })),
      }));

      return res.json({
        access,
        ownerTeacherId: OWNER_TEACHER_ID,
        ...buildOwnerTeachersDashboard(normalizedTeachers),
      });
    } catch (error: any) {
      const status = error.message === 'Acesso restrito ao criador.' ? 403 : 500;
      if (status === 500) console.error(error);
      return res.status(status).json({ message: error.message || 'Erro ao gerar dashboard de professores.' });
    }
  }
}
