import prisma from '../models/prisma';
import { SleepRecordLike } from '../types/sleepRecord';
import { buildTeacherAlertsForStudent, TeacherAlert } from './insightService';

type PendingAlert = { type: string; description: string; level: string };

async function createActiveAlertOnce(studentId: number, alert: PendingAlert) {
  const existing = await prisma.alert.findFirst({ where: { studentId, type: alert.type, resolved: false } });
  if (existing) {
    if (existing.description !== alert.description || existing.level !== alert.level) {
      return prisma.alert.update({ where: { id: existing.id }, data: { description: alert.description, level: alert.level } });
    }
    return existing;
  }
  return prisma.alert.create({ data: { studentId, type: alert.type, description: alert.description, level: alert.level } });
}

async function resolveInactiveAlerts(studentId: number, activeTypes: string[]) {
  await prisma.alert.updateMany({ where: { studentId, resolved: false, type: { notIn: activeTypes } }, data: { resolved: true, resolvedAt: new Date() } });
}

function toPending(alert: TeacherAlert): PendingAlert {
  return { type: alert.type, description: alert.message, level: alert.level };
}

export async function generateAlertsForStudent(studentId: number, records: SleepRecordLike[], _weeklyAverage?: number, _previousAverage?: number) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true, sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 } } });
  const studentName = student?.user.name || 'Aluno';
  const officialAlerts = buildTeacherAlertsForStudent(studentId, studentName, records, student?.sleepGoals[0] ?? null).map(toPending);

  await resolveInactiveAlerts(studentId, officialAlerts.map((alert) => alert.type));
  for (const alert of officialAlerts) await createActiveAlertOnce(studentId, alert);
}
