import { Request, Response } from 'express';
import prisma from '../models/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { normalizeEmail, normalizeProfile, validateRegisterFields } from '../validation';
import { AuthRequest } from '../middleware/authMiddleware';
import { resetLoginRateLimit } from '../middleware/rateLimitMiddleware';

export class AuthController {
  static async register(req: Request, res: Response) {
    const { name, email, password, profile, teacherCode, adminSecret } = req.body;
    const normalizedProfile = normalizeProfile(profile);

    try {
      validateRegisterFields(name, email, password, profile, teacherCode);
      if (normalizedProfile === 'teacher') {
        const expectedSecret = process.env.ADMIN_CREATE_TEACHER_SECRET;
        const isProduction = process.env.NODE_ENV === 'production';
        if ((isProduction || expectedSecret) && String(adminSecret || '') !== String(expectedSecret || '')) {
          return res.status(403).json({ message: 'Cadastro de professor não autorizado.' });
        }
      }
      const cleanEmail = normalizeEmail(email);
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) return res.status(400).json({ message: 'E-mail já registrado.' });

      const hashed = await bcrypt.hash(password, 10);
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { name: String(name).trim(), email: cleanEmail, password: hashed, profile: normalizedProfile } });

        if (normalizedProfile === 'teacher') {
          const teacher = await tx.teacher.create({ data: { userId: user.id } });
          return { user, teacher, student: null };
        }

        let teacherId: number | undefined;
        if (teacherCode) {
          const teacherUserId = Number(String(teacherCode).replace(/[^0-9]/g, ''));
          const teacher = Number.isFinite(teacherUserId)
            ? await tx.teacher.findUnique({ where: { id: teacherUserId } })
            : null;
          if (!teacher) throw new Error('Código de professor inválido. Peça o código correto ao seu professor.');
          teacherId = teacher.id;
        }

        const student = await tx.student.create({ data: { userId: user.id, teacherId } });
        return { user, teacher: null, student };
      });

      const token = jwt.sign({ id: result.user.id, profile: result.user.profile }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({
        token,
        user: { id: result.user.id, name: result.user.name, email: result.user.email, profile: result.user.profile },
        teacherCode: result.teacher ? String(result.teacher.id) : undefined,
      });
    } catch (error: any) {
      console.error(error);
      return res.status(400).json({ message: error.message || 'Erro ao criar usuário.' });
    }
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Login/e-mail e senha são obrigatórios.' });

    try {
      const loginValue = String(email).trim();
      const normalizedLogin = normalizeEmail(loginValue);
      const user = loginValue.includes('@')
        ? await prisma.user.findUnique({ where: { email: normalizedLogin } })
        : await prisma.user.findFirst({
            where: {
              name: { equals: loginValue },
              active: true,
            },
          });
      if (!user || !user.active) return res.status(401).json({ message: 'Credenciais inválidas.' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: 'Credenciais inválidas.' });

      resetLoginRateLimit(req);
      const token = jwt.sign({ id: user.id, profile: user.profile }, JWT_SECRET, { expiresIn: '7d' });
      let teacherCode: string | undefined;
      // Caso o perfil seja professor, também retornamos o ID da tabela teacher para exibir como código.
      if (user.profile === 'teacher') {
        try {
          const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
          teacherCode = teacher ? String(teacher.id) : undefined;
        } catch (err) {
          console.error('Erro ao buscar código do professor:', err);
        }
      }
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, profile: user.profile }, teacherCode });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao autenticar.' });
    }
  }

  static async me(req: AuthRequest, res: Response) {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuário não autenticado.' });
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.active) return res.status(404).json({ message: 'Usuário não encontrado.' });
      let teacherCode: string | undefined;
      if (user.profile === 'teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
        teacherCode = teacher ? String(teacher.id) : undefined;
      }
      return res.json({ id: user.id, name: user.name, email: user.email, profile: user.profile, teacherCode, user: { id: user.id, name: user.name, email: user.email, profile: user.profile } });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar sessão.' });
    }
  }

  static async updateMe(req: AuthRequest, res: Response) {
    if (!req.user?.id) return res.status(401).json({ message: 'Usuario nao autenticado.' });

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();

    if (name.length < 2) return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'E-mail invalido.' });

    try {
      const cleanEmail = normalizeEmail(email);
      const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!currentUser || !currentUser.active) return res.status(404).json({ message: 'Usuario nao encontrado.' });

      const existingEmailUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingEmailUser && existingEmailUser.id !== req.user.id) {
        return res.status(400).json({ message: 'E-mail ja registrado.' });
      }

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { name, email: cleanEmail },
      });

      let teacherCode: string | undefined;
      if (user.profile === 'teacher') {
        const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
        teacherCode = teacher ? String(teacher.id) : undefined;
      }

      return res.json({
        user: { id: user.id, name: user.name, email: user.email, profile: user.profile },
        teacherCode,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao atualizar perfil.' });
    }
  }

}
