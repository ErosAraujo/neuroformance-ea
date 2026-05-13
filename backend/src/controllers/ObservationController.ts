import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId } from '../services/identityService';
import { validateLimitedText } from '../validation';

export class ObservationController {
  static async store(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') {
      return res.status(403).json({
        message: 'Apenas professores podem adicionar observações.'
      });
    }

    try {
      const teacherUserId = req.user?.id;

      if (!teacherUserId) {
        return res.status(401).json({
          message: 'Usuário não autenticado.'
        });
      }

      const teacherId = await getTeacherIdByUserId(teacherUserId);

      const studentId = Number(req.params.studentId);
      const { text } = req.body;

      if (!Number.isFinite(studentId)) {
        return res.status(400).json({
          message: 'Aluno inválido.'
        });
      }

      const cleanText = validateLimitedText(text, 'Observação', 1000, 3) || '';

      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          teacherId,
          status: { not: 'deleted' }
        }
      });

      if (!student) {
        return res.status(404).json({
          message: 'Aluno não encontrado.'
        });
      }

      const observation = await prisma.observation.create({
        data: {
          studentId,
          teacherId,
          text: cleanText
        }
      });

      return res.status(201).json(observation);

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: 'Erro ao salvar observação.'
      });
    }
  }
}