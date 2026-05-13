import prisma from '../models/prisma';
import { SleepRecordLike } from '../types/sleepRecord';
import { calculateDailyIndicators } from './indicatorService';

type PendingAlert = { type: string; description: string; level: string };

async function createActiveAlertOnce(studentId: number, alert: PendingAlert) {
  const existing = await prisma.alert.findFirst({ where: { studentId, type: alert.type, resolved: false } });
  if (existing) return existing;
  return prisma.alert.create({ data: { studentId, type: alert.type, description: alert.description, level: alert.level } });
}

async function resolveInactiveAlerts(studentId: number, activeTypes: string[]) {
  await prisma.alert.updateMany({ where: { studentId, resolved: false, type: { notIn: activeTypes } }, data: { resolved: true, resolvedAt: new Date() } });
}

function hasEnoughHistoryForAdherence(studentCreatedAt: Date | undefined, recordsCount: number) {
  if (recordsCount >= 3) return true;
  if (!studentCreatedAt) return false;
  const created = new Date(studentCreatedAt); created.setUTCHours(0, 0, 0, 0);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const ageDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return ageDays >= 4;
}

export async function generateAlertsForStudent(studentId: number, records: SleepRecordLike[], weeklyAverage: number, previousAverage?: number) {
  const alerts: PendingAlert[] = [];
  const [activeGoal, student] = await Promise.all([
    prisma.sleepGoal.findFirst({ where: { studentId, active: true }, orderBy: { createdAt: 'desc' } }),
    prisma.student.findUnique({ where: { id: studentId }, include: { user: true } }),
  ]);
  const hourGoal = activeGoal?.hoursGoal ?? 7;

  if (records.length >= 2 && weeklyAverage < 55) alerts.push({ type: 'media_abaixo_55', description: 'A média dos últimos 7 dias ficou abaixo de 55 pontos.', level: 'danger' });
  if (previousAverage !== undefined && records.length >= 2 && weeklyAverage < previousAverage - 5) alerts.push({ type: 'queda_media', description: 'Sua média dos últimos 7 dias caiu em relação ao período anterior.', level: 'warning' });

  const lastThree = [...records].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-3);
  if (lastThree.length === 3 && lastThree.every((r) => r.scoreTotal < 55)) alerts.push({ type: 'tres_ruins', description: 'Você teve três noites ruins consecutivas.', level: 'danger' });

  const avgRegularity = records.reduce((sum, r) => sum + r.scoreRegularity, 0) / (records.length || 1);
  if (records.length >= 3 && avgRegularity < 5) alerts.push({ type: 'irregularidade', description: 'Seus horários de dormir e acordar estão muito irregulares.', level: 'warning' });

  const avgHours = records.reduce((sum, r) => sum + r.totalHours, 0) / (records.length || 1);
  if (records.length >= 3 && avgHours < hourGoal) alerts.push({ type: 'poucas_horas', description: `Sua média de horas ficou abaixo da meta atual de ${hourGoal}h.`, level: 'warning' });

  if (hasEnoughHistoryForAdherence(student?.user.createdAt, records.length) && records.length < 4) {
    alerts.push({ type: 'baixa_adesao', description: 'Menos de 4 registros foram feitos nos últimos 7 dias.', level: 'warning' });
  }

  const indicators = calculateDailyIndicators(lastThree as any);
  if (indicators.readinessScore !== null && indicators.readinessScore < 55) alerts.push({ type: 'prontidao_baixa', description: `Prontidão para treino em ${indicators.readinessScore}/100 (${indicators.readinessClassification}).`, level: indicators.readinessScore < 40 ? 'danger' : 'warning' });
  if (indicators.fatigue.value !== null && indicators.fatigue.value >= 70) alerts.push({ type: 'fadiga_alta', description: `Fadiga geral em ${indicators.fatigue.value}/100 (${indicators.fatigue.classification}).`, level: indicators.fatigue.value >= 85 ? 'danger' : 'warning' });
  if (indicators.overloadRisk.value !== null && indicators.overloadRisk.value >= 70) alerts.push({ type: 'sobrecarga_alta', description: `Risco de sobrecarga em ${indicators.overloadRisk.value}/100 (${indicators.overloadRisk.classification}).`, level: indicators.overloadRisk.value >= 85 ? 'danger' : 'warning' });
  if (indicators.recovery.value !== null && indicators.recovery.value < 55) alerts.push({ type: 'recuperacao_corporal_baixa', description: `Recuperação corporal em ${indicators.recovery.value}/100 (${indicators.recovery.classification}).`, level: indicators.recovery.value < 40 ? 'danger' : 'warning' });
  if (indicators.alertness.value !== null && indicators.alertness.value < 55) alerts.push({ type: 'estado_alerta_baixo', description: `Estado de alerta em ${indicators.alertness.value}/100 (${indicators.alertness.classification}).`, level: indicators.alertness.value < 40 ? 'danger' : 'warning' });
  if (indicators.mentalFocus.value !== null && indicators.mentalFocus.value < 55) alerts.push({ type: 'foco_mental_baixo', description: `Foco mental em ${indicators.mentalFocus.value}/100 (${indicators.mentalFocus.classification}).`, level: indicators.mentalFocus.value < 40 ? 'danger' : 'warning' });

  await resolveInactiveAlerts(studentId, alerts.map((alert) => alert.type));
  for (const alert of alerts) await createActiveAlertOnce(studentId, alert);
}
