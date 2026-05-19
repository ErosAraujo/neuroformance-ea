import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getTeacherIdByUserId } from '../services/identityService';
import { getRollingLast7DaysRange } from '../services/timeService';
import { calculateDailyIndicators } from '../services/indicatorService';
import { mapSleepGoal, mapSleepRecordForTeacher } from '../services/teacherDashboardService';
import { buildTeacherStudentProfile } from '../services/insightService';

function avg(records: { scoreTotal: number }[]) {
  return records.length ? records.reduce((sum, record) => sum + record.scoreTotal, 0) / records.length : 0;
}

function trendFrom(current: number, previous: number, hasPrevious: boolean) {
  if (!hasPrevious) return 'estável';
  if (current > previous + 5) return 'melhorando';
  if (current < previous - 5) return 'piorando';
  return 'estável';
}

function daysSince(date?: Date | null) {
  if (!date) return Number.POSITIVE_INFINITY;
  const start = new Date(date); start.setUTCHours(0, 0, 0, 0);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function priorityFrom(args: { lastScore?: number; weeklyAverage: number; adherence: number; alerts: { level: string }[]; trend: string; totalRecords: number; daysWithoutRecord: number }) {
  const { lastScore, weeklyAverage, adherence, alerts, trend, totalRecords, daysWithoutRecord } = args;
  const hasDanger = alerts.some((a) => a.level === 'danger');
  if (totalRecords === 0) return 'acompanhamento';
  if (totalRecords <= 2) return lastScore !== undefined && lastScore < 55 ? 'alta' : 'normal';
  if ((lastScore !== undefined && lastScore < 55) || (weeklyAverage < 55 && totalRecords >= 2) || hasDanger || daysWithoutRecord > 4) return 'alta';
  if (trend === 'piorando' || adherence < 60 || (lastScore !== undefined && lastScore >= 55 && lastScore <= 69)) return 'média';
  return 'normal';
}

function statusFrom(totalRecords: number, alertCount: number, trend: string) {
  if (totalRecords === 0) return 'sem dados';
  if (totalRecords <= 2) return 'acompanhamento inicial';
  if (alertCount > 0) return 'em alerta';
  return trend;
}

function recommendation(priority: string, trend: string, adherence: number, totalRecords: number, lastRecordToday: boolean, lastScore?: number) {
  if (totalRecords === 0) return 'Aguardar primeiros registros para análise.';
  if (lastRecordToday && lastScore !== undefined && lastScore >= 85) return 'Manter rotina atual e acompanhar evolução nos próximos registros.';
  if (priority === 'alta') return 'Ajustar rotina de sono e reduzir cobrança de intensidade.';
  if (trend === 'piorando') return 'Revisar horários, telas à noite e consistência das últimas noites.';
  if (totalRecords >= 3 && adherence < 60) return 'Reforçar registro diário com linguagem simples e meta mínima de acompanhamento.';
  return 'Manter rotina atual e acompanhar a evolução semanal.';
}

export class StudentsController {
  static async list(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') {
      return res.status(403).json({ message: 'Apenas professores podem listar alunos.' });
    }
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      // Permite filtrar por status: active, archived, deleted ou all. Por padrão retorna apenas ativos.
      const statusParam = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'active';
      const whereStatus: any = { teacherId };
      if (statusParam === 'archived') whereStatus.status = 'archived';
      else if (statusParam === 'deleted') whereStatus.status = 'deleted';
      else if (statusParam === 'all') whereStatus.status = { not: 'deleted' };
      else whereStatus.status = 'active';
      const students = await prisma.student.findMany({
        where: whereStatus,
        include: {
          user: true,
          sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      const ids = students.map((student) => student.id);
      const { start: weekStart, end: weekEnd, previousStart, previousEnd } = getRollingLast7DaysRange();
      const [weekRecords, prevRecords, alerts, allRecords] = await Promise.all([
        prisma.sleepRecord.findMany({ where: { studentId: { in: ids }, date: { gte: weekStart, lte: weekEnd } } }),
        prisma.sleepRecord.findMany({ where: { studentId: { in: ids }, date: { gte: previousStart, lte: previousEnd } } }),
        prisma.alert.findMany({ where: { studentId: { in: ids }, resolved: false } }),
        prisma.sleepRecord.findMany({ where: { studentId: { in: ids } }, orderBy: { date: 'desc' } }),
      ]);
      const result = students.map((student) => {
        const current = weekRecords.filter((record) => record.studentId === student.id).sort((a, b) => b.date.getTime() - a.date.getTime());
        const previous = prevRecords.filter((record) => record.studentId === student.id);
        const studentAlerts = alerts.filter((alert) => alert.studentId === student.id);
        const studentAllRecords = allRecords.filter((record) => record.studentId === student.id);
        const lastRecord = studentAllRecords[0];
        const weeklyAverage = avg(current);
        const previousAverage = avg(previous);
        const trend = studentAllRecords.length === 0 ? 'sem dados' : trendFrom(weeklyAverage, previousAverage, previous.length > 0 && current.length > 0);
        const adherence = (current.length / 7) * 100;
        const alertCount = studentAlerts.length;
        const status = statusFrom(studentAllRecords.length, alertCount, trend);
        const priority = priorityFrom({ lastScore: lastRecord?.scoreTotal, weeklyAverage, adherence, alerts: studentAlerts, trend, totalRecords: studentAllRecords.length, daysWithoutRecord: daysSince(lastRecord?.date) });

        const indicators = calculateDailyIndicators(studentAllRecords.slice(0, 3).reverse());
        return {
          id: student.id,
          name: student.user.name,
          email: student.user.email,
          weeklyAverage,
          trackingStatus: status,
          studentStatus: student.status,
          status: student.status,
          archivedAt: student.archivedAt,
          deletedAt: student.deletedAt,
          trend,
          adherence,
          priority,
          alertCount,
          lastRecord: mapSleepRecordForTeacher(lastRecord),
          recentRecords: studentAllRecords.slice(0, 30).map(mapSleepRecordForTeacher),
          recordsLast7Days: current.map(mapSleepRecordForTeacher),
          activeSleepGoal: mapSleepGoal(student.sleepGoals[0] ?? null),
          activeGoal: mapSleepGoal(student.sleepGoals[0] ?? null),
          // Novos campos para indicadores
          hasData: indicators.hasData,
          baseReduced: indicators.baseReduced,
          recordsUsed: indicators.recordsUsed,
          readinessScore: indicators.readinessScore,
          readinessClassification: indicators.readinessClassification,
          alertness: indicators.alertness,
          fatigue: indicators.fatigue,
          mentalFocus: indicators.mentalFocus,
          recovery: indicators.recovery,
          overloadRisk: indicators.overloadRisk,
          generalStatus: indicators.generalStatus,
          generalStatusScore: indicators.generalStatusScore,
          generalStatusClassification: indicators.generalStatusClassification,
          indicatorTrend: indicators.trend,
        };
      });
      return res.json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao listar alunos.' });
    }
  }

  /**
   * Arquiva um aluno. Altera status para 'archived' e define archivedAt. Mantém dados no banco.
   */
  static async archive(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') return res.status(403).json({ message: 'Apenas professores podem arquivar alunos.' });
    const id = Number(req.params.id);
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student || student.teacherId !== teacherId) return res.status(404).json({ message: 'Aluno não encontrado.' });
      await prisma.student.update({ where: { id }, data: { status: 'archived', archivedAt: new Date(), active: false } });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao arquivar aluno.' });
    }
  }

  /**
   * Restaura um aluno arquivado, definindo status como 'active'.
   */
  static async restore(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') return res.status(403).json({ message: 'Apenas professores podem restaurar alunos.' });
    const id = Number(req.params.id);
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student || student.teacherId !== teacherId) return res.status(404).json({ message: 'Aluno não encontrado.' });
      await prisma.student.update({ where: { id }, data: { status: 'active', archivedAt: null, deletedAt: null, active: true } });
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao restaurar aluno.' });
    }
  }

  /**
   * Remove logicamente um aluno, definindo status como 'deleted'.
   */
  static async delete(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') return res.status(403).json({ message: 'Apenas professores podem deletar alunos.' });
    const id = Number(req.params.id);
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student || student.teacherId !== teacherId) return res.status(404).json({ message: 'Aluno não encontrado.' });
      await prisma.student.update({ where: { id }, data: { status: 'deleted', deletedAt: new Date(), active: false } });
      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao deletar aluno.' });
    }
  }

  static async detail(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'teacher') {
      return res.status(403).json({ message: 'Apenas professores podem acessar detalhes.' });
    }
    const id = Number(req.params.id);
    try {
      const teacherId = await getTeacherIdByUserId(req.user.id);
      const student = await prisma.student.findUnique({
        where: { id },
        include: {
          user: true,
          sleepGoals: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (!student || student.teacherId !== teacherId || student.status === 'deleted') return res.status(404).json({ message: 'Aluno não encontrado.' });
      const { start: weekStart, end: weekEnd, previousStart, previousEnd } = getRollingLast7DaysRange();
      const monthStart = new Date(); monthStart.setUTCDate(monthStart.getUTCDate() - 30); monthStart.setUTCHours(0, 0, 0, 0);
      const prevMonthStart = new Date(monthStart); prevMonthStart.setUTCDate(prevMonthStart.getUTCDate() - 30);
      const prevMonthEnd = new Date(monthStart); prevMonthEnd.setUTCDate(prevMonthEnd.getUTCDate() - 1); prevMonthEnd.setUTCHours(23, 59, 59, 999);
      const [weekRecords, monthRecords, prevWeekRecords, prevMonthRecords, alerts, lastRecord, observations, recentRecords, allRecords] = await Promise.all([
        prisma.sleepRecord.findMany({ where: { studentId: id, date: { gte: weekStart, lte: weekEnd } } }),
        prisma.sleepRecord.findMany({ where: { studentId: id, date: { gte: monthStart } } }),
        prisma.sleepRecord.findMany({ where: { studentId: id, date: { gte: previousStart, lte: previousEnd } } }),
        prisma.sleepRecord.findMany({ where: { studentId: id, date: { gte: prevMonthStart, lte: prevMonthEnd } } }),
        prisma.alert.findMany({ where: { studentId: id, resolved: false }, orderBy: { date: 'desc' } }),
        prisma.sleepRecord.findFirst({ where: { studentId: id }, orderBy: { date: 'desc' } }),
        prisma.observation.findMany({ where: { studentId: id, teacherId }, orderBy: { date: 'desc' } }),
        prisma.sleepRecord.findMany({ where: { studentId: id }, orderBy: { date: 'desc' }, take: 30 }),
        prisma.sleepRecord.findMany({ where: { studentId: id }, orderBy: { date: 'desc' } }),
      ]);
      const averageWeek = avg(weekRecords);
      const averageMonth = avg(monthRecords);
      const trendWeekly = allRecords.length === 0 ? 'sem dados' : trendFrom(averageWeek, avg(prevWeekRecords), prevWeekRecords.length > 0 && weekRecords.length > 0);
      const trendMonthly = allRecords.length === 0 ? 'sem dados' : trendFrom(averageMonth, avg(prevMonthRecords), prevMonthRecords.length > 0 && monthRecords.length > 0);
      const adherence = (weekRecords.length / 7) * 100;
      const regularityAvg = weekRecords.length ? weekRecords.reduce((sum, r) => sum + r.scoreRegularity, 0) / weekRecords.length : 0;
      const goodNights = weekRecords.filter((r) => r.scoreTotal >= 70).length;
      const badNights = weekRecords.filter((r) => r.scoreTotal < 55).length;
      const priority = priorityFrom({ lastScore: lastRecord?.scoreTotal, weeklyAverage: averageWeek, adherence, alerts, trend: trendWeekly, totalRecords: allRecords.length, daysWithoutRecord: daysSince(lastRecord?.date) });
      const lastRecordToday = lastRecord ? daysSince(lastRecord.date) === 0 : false;
      const indicators = calculateDailyIndicators(allRecords.slice(0, 3).reverse());

      return res.json({
        id: student.id,
        name: student.user.name,
        email: student.user.email,
        login: student.user.email,
        activeSleepGoal: mapSleepGoal(student.sleepGoals[0] ?? null),
        activeGoal: mapSleepGoal(student.sleepGoals[0] ?? null),
        weeklyAverage: averageWeek,
        monthlyAverage: averageMonth,
        trendWeekly,
        trendMonthly,
        regularity: regularityAvg,
        adherence,
        priority,
        risk: priority === 'alta' ? 'Alto' : priority === 'média' ? 'Moderado' : priority === 'normal' ? 'Controlado' : 'Baixo',
        trackingStatus: statusFrom(allRecords.length, alerts.length, trendWeekly),
        studentStatus: student.status,
        status: student.status,
        archivedAt: student.archivedAt,
        deletedAt: student.deletedAt,
        recommendation: recommendation(priority, trendWeekly, adherence, allRecords.length, lastRecordToday, lastRecord?.scoreTotal),
        goodNights,
        badNights,
        lastRecord: mapSleepRecordForTeacher(lastRecord),
        alerts: alerts.map((a) => ({ id: a.id, studentId: a.studentId, studentName: student.user.name, type: a.type, title: a.type, message: a.description, description: a.description, level: a.level, severity: a.level, date: a.date, status: a.resolved ? 'Resolvido' : 'Ativo', source: 'database' })),
        observations: observations.map((o) => ({ date: o.date, text: o.text })),
        recentRecords: recentRecords.map(mapSleepRecordForTeacher),
        // novos indicadores calculados
        hasData: indicators.hasData,
        baseReduced: indicators.baseReduced,
        recordsUsed: indicators.recordsUsed,
        readinessScore: indicators.readinessScore,
        readinessClassification: indicators.readinessClassification,
        alertness: indicators.alertness,
        fatigue: indicators.fatigue,
        mentalFocus: indicators.mentalFocus,
        recovery: indicators.recovery,
        overloadRisk: indicators.overloadRisk,
        generalStatus: indicators.generalStatus,
        generalStatusScore: indicators.generalStatusScore,
        generalStatusClassification: indicators.generalStatusClassification,
        indicatorTrend: indicators.trend,
        profileInsights: buildTeacherStudentProfile(student.id, student.user.name, allRecords, student.sleepGoals[0] ?? null),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao obter detalhes do aluno.' });
    }
  }
}
