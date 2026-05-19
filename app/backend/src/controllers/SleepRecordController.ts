import { Response } from 'express';
import prisma from '../models/prisma';
import { calculateSleepScore, getFatigueRisk, getRecoveryLevel } from '../services/scoreService';
import { consolidateWeek } from '../services/consolidationService';
import { generateAlertsForStudent } from '../services/alertService';
import { calculateDailyIndicators } from '../services/indicatorService';
import { buildPostRecordInsights } from '../services/insightService';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';
import { assertNotFutureDate, calculateTotalHours, circularMinuteDiff, getRollingLast7DaysRange, minutesFromDate, parseDateOnly } from '../services/timeService';
import { assertRange, parseOptionalBoolean, parseOptionalNumber, validateLimitedText } from '../validation';

async function buildSleepRecordPayload(studentId: number, body: any, ignoreRecordId?: number) {
  const { date, sleepTime, wakeTime, perceivedQuality, awakenings, morningState, energy, notes, timeToSleep, nap, caffeine, alcohol, screenBeforeSleep, stress, pain, mood, generalPain, bodyHeaviness } = body;

  const qualityNumber = assertRange(perceivedQuality, 1, 5, 'Qualidade do sono');
  const awakeningsNumber = assertRange(awakenings, 0, 20, 'Despertares');
  const stateNumber = assertRange(morningState, 1, 5, 'Estado ao acordar');
  const energyNumber = assertRange(energy, 1, 5, 'Energia ao acordar');

  const sleepDate = parseDateOnly(date);
  assertNotFutureDate(sleepDate);
  const existingRecord = await prisma.sleepRecord.findUnique({ where: { studentId_date: { studentId, date: sleepDate } } });
  if (existingRecord && existingRecord.id !== ignoreRecordId) {
    throw new Error('Já existe um registro de sono para este aluno nesta data. Abra o registro existente para editar essa noite.');
  }

  const { totalHours, sleepDateTime, wakeDateTime } = calculateTotalHours(date, sleepTime, wakeTime);
  const parsedTimeToSleep = parseOptionalNumber(timeToSleep, 0, 240, 'Tempo para pegar no sono');
  const parsedStress = parseOptionalNumber(stress, 1, 5, 'Estresse');
  const parsedMood = parseOptionalNumber(mood, 1, 5, 'Humor');
  const parsedGeneralPain = parseOptionalNumber(generalPain, 1, 5, 'Dor muscular geral');
  const parsedBodyHeaviness = parseOptionalNumber(bodyHeaviness, 1, 5, 'Sensação de corpo pesado');
  const parsedNotes = validateLimitedText(notes, 'Observação', 200);

  const last7 = await prisma.sleepRecord.findMany({
    where: ignoreRecordId ? { studentId, id: { not: ignoreRecordId } } : { studentId },
    orderBy: { date: 'desc' },
    take: 7,
  });
  const currentMinutes = minutesFromDate(sleepDateTime);
  const averageMinutes = last7.length
    ? last7.reduce((sum, rec) => sum + minutesFromDate(rec.sleepTime), 0) / last7.length
    : currentMinutes;
  const variation = circularMinuteDiff(currentMinutes, averageMinutes);

  const score = calculateSleepScore({
    totalHours,
    perceivedQuality: qualityNumber,
    awakenings: awakeningsNumber,
    morningState: stateNumber,
    regularityVariation: variation,
  });

  return {
    studentId,
    date: sleepDate,
    sleepTime: sleepDateTime,
    wakeTime: wakeDateTime,
    totalHours,
    perceivedQuality: qualityNumber,
    awakenings: awakeningsNumber,
    morningState: stateNumber,
    energy: energyNumber,
    timeToSleep: parsedTimeToSleep,
    nap: parseOptionalBoolean(nap),
    caffeine: parseOptionalBoolean(caffeine),
    alcohol: parseOptionalBoolean(alcohol),
    screenBeforeSleep: parseOptionalBoolean(screenBeforeSleep),
    stress: parsedStress,
    generalPain: parsedGeneralPain,
    bodyHeaviness: parsedBodyHeaviness,
    pain: parseOptionalBoolean(pain),
    mood: parsedMood,
    notes: parsedNotes,
    scoreDuration: score.duration,
    scoreQuality: score.quality,
    scoreContinuity: score.continuity,
    scoreState: score.state,
    scoreRegularity: score.regularity,
    scoreTotal: score.total,
    classification: score.classification,
  };
}

async function refreshStudentAlerts(studentId: number, referenceDate: Date) {
  const { start: weekStart, end: weekEnd, previousStart: prevWeekStart, previousEnd: prevWeekEnd } = getRollingLast7DaysRange(referenceDate);
  const weekRecords = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: weekStart, lte: weekEnd } }, orderBy: { date: 'asc' } });
  if (!weekRecords.length) return;
  const prevRecords = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: prevWeekStart, lte: prevWeekEnd } } });
  const prevAverage = prevRecords.length ? prevRecords.reduce((sum, r) => sum + r.scoreTotal, 0) / prevRecords.length : undefined;
  const weeklyAverage = weekRecords.reduce((sum, r) => sum + r.scoreTotal, 0) / weekRecords.length;
  await generateAlertsForStudent(studentId, weekRecords, weeklyAverage, prevAverage);
}

export class SleepRecordController {
  static async recoverySummary(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const lastThree = await prisma.sleepRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 3 });

      if (!lastThree.length) {
        return res.json({
          hasData: false,
          recoveryLevel: null,
          readinessScore: null,
          fatigueRisk: null,
          recoveryScore: null,
          weeklyTrendPercent: null,
          trainingSuggestion: 'Registre sua primeira noite para criar sua linha de base.',
        });
      }

      const lastRecord = lastThree[0];
      const readinessScore = Math.round(lastThree.reduce((sum, record) => sum + record.scoreTotal, 0) / lastThree.length);
      const recoveryScore = Math.round(lastRecord.scoreTotal);

      const { start, end, previousStart, previousEnd } = getRollingLast7DaysRange();
      const currentWeekRecords = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: start, lte: end } } });
      const previousWeekRecords = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: previousStart, lte: previousEnd } } });
      const currentAverage = currentWeekRecords.length ? currentWeekRecords.reduce((sum, record) => sum + record.scoreTotal, 0) / currentWeekRecords.length : null;
      const previousAverage = previousWeekRecords.length ? previousWeekRecords.reduce((sum, record) => sum + record.scoreTotal, 0) / previousWeekRecords.length : null;
      const weeklyTrendPercent = currentAverage !== null && previousAverage !== null && previousAverage > 0
        ? Math.round(((currentAverage - previousAverage) / previousAverage) * 100)
        : null;

      const trainingSuggestion = readinessScore >= 85
        ? 'Prontidão alta: hoje comporta treino forte, mantendo boa técnica.'
        : readinessScore >= 70
          ? 'Prontidão boa: treino normal, com atenção à resposta do corpo.'
          : readinessScore >= 55
            ? 'Prontidão média: treinar moderado e priorizar dormir mais cedo.'
            : readinessScore >= 40
              ? 'Prontidão baixa: reduzir volume e evitar forçar intensidade máxima.'
              : 'Prontidão crítica: priorizar recuperação e ajustar a sessão com cautela.';

      return res.json({
        hasData: true,
        recoveryLevel: getRecoveryLevel(recoveryScore),
        readinessScore,
        fatigueRisk: getFatigueRisk(readinessScore),
        recoveryScore,
        weeklyTrendPercent,
        trainingSuggestion,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao calcular recuperação.' });
    }
  }

  static async index(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar seus registros.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const days = req.query.days ? Number(req.query.days) : undefined;
      const start = typeof req.query.start === 'string' ? parseDateOnly(req.query.start) : undefined;
      const end = typeof req.query.end === 'string' ? parseDateOnly(req.query.end) : undefined;
      if (end) end.setUTCHours(23, 59, 59, 999);
      const where: any = { studentId };
      if (days && Number.isFinite(days)) {
        const from = new Date();
        from.setDate(from.getDate() - days);
        where.date = { gte: from };
      } else if (start || end) {
        where.date = {};
        if (start) where.date.gte = start;
        if (end) where.date.lte = end;
      }
      const records = await prisma.sleepRecord.findMany({ where, orderBy: { date: 'desc' } });
      return res.json(records);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao listar registros.' });
    }
  }

  static async last(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const record = await prisma.sleepRecord.findFirst({ where: { studentId }, orderBy: { date: 'desc' } });
      return res.json(record);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar último registro.' });
    }
  }

  static async weeklySummary(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const { start, end, previousStart, previousEnd } = getRollingLast7DaysRange();
      const records = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } });
      const previousRecords = await prisma.sleepRecord.findMany({ where: { studentId, date: { gte: previousStart, lte: previousEnd } }, orderBy: { date: 'asc' } });
      const previousAverage = previousRecords.length ? previousRecords.reduce((sum, r) => sum + r.scoreTotal, 0) / previousRecords.length : undefined;
      const summary = consolidateWeek(records, previousAverage);
      return res.json(summary);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao calcular resumo semanal.' });
    }
  }

  static async show(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const id = Number(req.params.id);
      const record = await prisma.sleepRecord.findFirst({ where: { id, studentId } });
      if (!record) return res.status(404).json({ message: 'Registro não encontrado.' });
      return res.json(record);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao buscar registro.' });
    }
  }

  static async store(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem registrar.' });

    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const data = await buildSleepRecordPayload(studentId, req.body);
      const record = await prisma.sleepRecord.create({ data });
      await refreshStudentAlerts(studentId, record.date);
      const [allRecords, activeGoal] = await Promise.all([
        prisma.sleepRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' } }),
        prisma.sleepGoal.findFirst({ where: { studentId, active: true }, orderBy: { createdAt: 'desc' } }),
      ]);
      const indicators = calculateDailyIndicators(allRecords.slice(0, 3).reverse());
      const postRecordInsights = buildPostRecordInsights(record, allRecords, activeGoal);
      return res.status(201).json({ record, indicators, postRecordInsights });
    } catch (error: any) {
      console.error(error);
      const status = String(error.message || '').includes('Já existe um registro') ? 409 : 400;
      return res.status(status).json({ message: error.message || 'Erro ao salvar registro.' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem editar seus registros.' });

    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID de registro inválido.' });

      const existing = await prisma.sleepRecord.findFirst({ where: { id, studentId } });
      if (!existing) return res.status(404).json({ message: 'Registro não encontrado.' });

      const data = await buildSleepRecordPayload(studentId, req.body, id);
      const record = await prisma.sleepRecord.update({ where: { id }, data });
      await refreshStudentAlerts(studentId, record.date);
      const [allRecords, activeGoal] = await Promise.all([
        prisma.sleepRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' } }),
        prisma.sleepGoal.findFirst({ where: { studentId, active: true }, orderBy: { createdAt: 'desc' } }),
      ]);
      const indicators = calculateDailyIndicators(allRecords.slice(0, 3).reverse());
      const postRecordInsights = buildPostRecordInsights(record, allRecords, activeGoal);
      return res.json({ record, indicators, postRecordInsights });
    } catch (error: any) {
      console.error(error);
      const status = String(error.message || '').includes('Já existe um registro') ? 409 : 400;
      return res.status(status).json({ message: error.message || 'Erro ao atualizar registro.' });
    }
  }
}
