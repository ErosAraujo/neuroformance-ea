import prisma from '../models/prisma';

export async function getStudentIdByUserId(userId: number): Promise<number> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw new Error('Aluno não encontrado para este usuário.');
  }
  return student.id;
}

export async function getTeacherIdByUserId(userId: number): Promise<number> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (teacher) return teacher.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.profile !== 'teacher' || !user.active) {
    throw new Error('Professor não encontrado para este usuário.');
  }

  const createdTeacher = await prisma.teacher.create({ data: { userId } });
  return createdTeacher.id;
}
