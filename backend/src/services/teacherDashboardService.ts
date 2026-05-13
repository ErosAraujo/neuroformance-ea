import { calculateDailyIndicators } from './indicatorService';
export type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type FatigueRiskLevel = 'baixo' | 'moderado' | 'alto' | 'elevado' | 'insuficiente';

export interface TeacherAlert {
  id: string;
  studentId: string | number;
  studentName: string;
  type: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  actionSuggestion: string;
  createdAt: string;
  active: boolean;
  source: 'backend';
}

export interface SleepGoalLike {
  id?: number | string;
  studentId?: number | string;
  hoursGoal?: number | null;
  sleepTimeGoal?: Date | string | null;
  wakeTimeGoal?: Date | string | null;
  regularityGoal?: number | null;
  active?: boolean;
  createdAt?: Date | string | null;
}

export interface SleepRecordLike {
  id?: number | string;
  studentId?: number | string;
  date?: Date | string | null;
  sleepTime?: Date | string | null;
  wakeTime?: Date | string | null;
  totalHours?: number | null;
  scoreTotal?: number | null;
  scoreDuration?: number | null;
  scoreQuality?: number | null;
  scoreContinuity?: number | null;
  scoreState?: number | null;
  scoreRegularity?: number | null;
  classification?: string | null;
  perceivedQuality?: number | null;
  awakenings?: number | null;
  morningState?: number | null;
  energy?: number | null;
  timeToSleep?: number | null;
  nap?: boolean | null;
  caffeine?: boolean | null;
  alcohol?: boolean | null;
  screenBeforeSleep?: boolean | null;
  pain?: boolean | null;
  notes?: string | null;
  createdAt?: Date | string | null;
  mood?: number | null;
  stress?: number | null;
  generalPain?: number | null;
  bodyHeaviness?: number | null;
}

export interface StudentLike {
  id: number | string;
  user?: { name?: string | null; email?: string | null; login?: string | null; username?: string | null } | null;
  name?: string | null;
  email?: string | null;
  login?: string | null;
  username?: string | null;
  sleepRecords?: SleepRecordLike[];
  sleepGoals?: SleepGoalLike[];
  activeSleepGoal?: SleepGoalLike | null;
}

export interface GoalStatus {
  hasActiveGoal: boolean;
  isGoalNotMet: boolean;
  isSevereDeficit: boolean;
  averageSleepHoursLast7Days: number | null;
  hoursGoal: number | null;
}

export interface FatigueRiskResult {
  value: number | null;
  level: FatigueRiskLevel;
  reason?: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function roundNumber(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getLocalTodayString(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function safeScore(value: unknown): number | null {
  if (!isValidNumber(value)) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

export function safeDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function normalizeLocalDate(date: unknown): string | null {
  if (typeof date === 'string') {
    const directDateOnly = date.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (directDateOnly) return directDateOnly;
  }
  const parsed = safeDate(date);
  if (!parsed) return null;
  return parsed.toISOString().slice(0, 10);
}

export function isToday(date: unknown, reference = new Date()): boolean {
  const normalized = normalizeLocalDate(date);
  return Boolean(normalized && normalized === getLocalTodayString(reference));
}

export function getExpectedSleepCheckInDate(reference = new Date()): string {
  const today = getLocalTodayString(reference);
  return new Date(dateOnlyToUtcMs(today) - MS_PER_DAY).toISOString().slice(0, 10);
}

export function isExpectedSleepCheckInRecordDate(date: unknown, reference = new Date()): boolean {
  const normalized = normalizeLocalDate(date);
  return Boolean(normalized && normalized === getExpectedSleepCheckInDate(reference));
}

function dateOnlyToUtcMs(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime();
}

function daysBetweenDateOnly(startDate: string, endDate: string): number {
  return Math.floor((dateOnlyToUtcMs(endDate) - dateOnlyToUtcMs(startDate)) / MS_PER_DAY);
}

function sortRecordsDesc(records: SleepRecordLike[]): SleepRecordLike[] {
  return [...records].sort((a, b) => {
    const dateA = normalizeLocalDate(a.date);
    const dateB = normalizeLocalDate(b.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateOnlyToUtcMs(dateB) - dateOnlyToUtcMs(dateA);
  });
}

function getValidScoreRecords(records: SleepRecordLike[]): SleepRecordLike[] {
  return sortRecordsDesc(records).filter((record) => safeScore(record.scoreTotal) !== null && normalizeLocalDate(record.date) !== null);
}

export function getLastValidRecords(records: SleepRecordLike[], limit: number): SleepRecordLike[] {
  return getValidScoreRecords(records).slice(0, Math.max(0, limit));
}

export function getRecordsLastDays(records: SleepRecordLike[], days: number, reference = new Date()): SleepRecordLike[] {
  const today = getLocalTodayString(reference);
  const fromMs = dateOnlyToUtcMs(today) - (Math.max(1, days) - 1) * MS_PER_DAY;
  const todayMs = dateOnlyToUtcMs(today);
  return sortRecordsDesc(records).filter((record) => {
    const normalized = normalizeLocalDate(record.date);
    if (!normalized) return false;
    const recordMs = dateOnlyToUtcMs(normalized);
    return recordMs >= fromMs && recordMs <= todayMs;
  });
}

export function averageScores(records: SleepRecordLike[]): number | null {
  const scores = records.map((record) => safeScore(record.scoreTotal)).filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return roundNumber(scores.reduce((sum, score) => sum + score, 0) / scores.length, 1);
}

export function averageSleepHours(records: SleepRecordLike[]): number | null {
  const hours = records
    .map((record) => (isValidNumber(record.totalHours) && record.totalHours >= 0 && record.totalHours <= 24 ? record.totalHours : null))
    .filter((value): value is number => value !== null);
  if (!hours.length) return null;
  return roundNumber(hours.reduce((sum, value) => sum + value, 0) / hours.length, 2);
}

export function getLatestRecord(records: SleepRecordLike[]): SleepRecordLike | null {
  return sortRecordsDesc(records).find((record) => normalizeLocalDate(record.date) !== null) ?? null;
}

export function calculateReadinessScore(student: StudentLike): number | null {
  const lastThree = getLastValidRecords(student.sleepRecords ?? [], 3);
  return averageScores(lastThree);
}

export function calculateRiskStudent(student: StudentLike): boolean {
  const records = student.sleepRecords ?? [];
  const lastThreeAverage = averageScores(getLastValidRecords(records, 3));
  const latestValid = getLastValidRecords(records, 1)[0];
  const latestScore = latestValid ? safeScore(latestValid.scoreTotal) : null;
  return (lastThreeAverage !== null && lastThreeAverage < 55) || (latestScore !== null && latestScore < 40);
}

export function calculateLowAdherence(student: StudentLike, reference = new Date()): { isLowAdherence: boolean; isCriticalAdherence: boolean; recordsLast7Days: SleepRecordLike[] } {
  const recordsLast7Days = getRecordsLastDays(student.sleepRecords ?? [], 7, reference);
  return {
    recordsLast7Days,
    isLowAdherence: recordsLast7Days.length < 3,
    isCriticalAdherence: recordsLast7Days.length === 0,
  };
}

export function calculateFatigueRisk(student: StudentLike): FatigueRiskResult {
  const lastThree = getLastValidRecords(student.sleepRecords ?? [], 3);
  if (lastThree.length < 3) return { value: null, level: 'insuficiente', reason: 'Menos de 3 registros válidos.' };

  const average = averageScores(lastThree);
  if (average === null) return { value: null, level: 'insuficiente', reason: 'Sem média válida.' };

  const sortedAsc = [...lastThree].sort((a, b) => {
    const dateA = normalizeLocalDate(a.date);
    const dateB = normalizeLocalDate(b.date);
    if (!dateA || !dateB) return 0;
    return dateOnlyToUtcMs(dateA) - dateOnlyToUtcMs(dateB);
  });
  const oldestScore = safeScore(sortedAsc[0]?.scoreTotal);
  const newestScore = safeScore(sortedAsc[sortedAsc.length - 1]?.scoreTotal);
  if (oldestScore === null || newestScore === null) return { value: null, level: 'insuficiente', reason: 'Scores insuficientes.' };

  const latestRecord = getLatestRecord(lastThree);
  const energy = latestRecord && isValidNumber(latestRecord.energy) ? latestRecord.energy : null;
  if (energy === null || energy < 1 || energy > 5) return { value: null, level: 'insuficiente', reason: 'Energia ausente no registro mais recente válido.' };

  const risk1 = 100 - average;
  const drop = oldestScore - newestScore;
  const risk2 = Math.min(Math.max((drop / 20) * 100, 0), 100);
  const risk3 = ((5 - energy) / 4) * 100;
  const finalRisk = roundNumber((risk1 * 0.5) + (risk2 * 0.3) + (risk3 * 0.2), 1);
  return { value: finalRisk, level: fatigueRiskLevel(finalRisk) };
}

export function fatigueRiskLevel(value: number | null): FatigueRiskLevel {
  if (value === null) return 'insuficiente';
  if (value > 75) return 'elevado';
  if (value >= 50) return 'alto';
  if (value >= 25) return 'moderado';
  return 'baixo';
}

function getActiveGoal(student: StudentLike): SleepGoalLike | null {
  if (student.activeSleepGoal) return student.activeSleepGoal;
  const goals = [...(student.sleepGoals ?? [])].filter((goal) => goal.active !== false);
  goals.sort((a, b) => {
    const dateA = safeDate(a.createdAt)?.getTime() ?? 0;
    const dateB = safeDate(b.createdAt)?.getTime() ?? 0;
    return dateB - dateA;
  });
  return goals[0] ?? null;
}

export function calculateGoalNotMet(student: StudentLike, reference = new Date()): GoalStatus {
  const activeGoal = getActiveGoal(student);
  const hoursGoal = activeGoal && isValidNumber(activeGoal.hoursGoal) ? activeGoal.hoursGoal : null;
  const recordsLast7Days = getRecordsLastDays(student.sleepRecords ?? [], 7, reference);
  const averageHours = averageSleepHours(recordsLast7Days);

  if (hoursGoal === null) {
    return { hasActiveGoal: false, isGoalNotMet: false, isSevereDeficit: false, averageSleepHoursLast7Days: averageHours, hoursGoal: null };
  }

  const isGoalNotMet = averageHours !== null && averageHours < hoursGoal;
  const isSevereDeficit = averageHours !== null && averageHours < hoursGoal - 1;
  return { hasActiveGoal: true, isGoalNotMet, isSevereDeficit, averageSleepHoursLast7Days: averageHours, hoursGoal };
}

function createTeacherAlert(args: Omit<TeacherAlert, 'id' | 'createdAt' | 'active' | 'source'> & { createdAt?: string }): TeacherAlert {
  return {
    ...args,
    id: `${args.studentId}:${args.type}`,
    createdAt: args.createdAt ?? new Date().toISOString(),
    active: true,
    source: 'backend',
  };
}

function hasConsecutiveLowScores(records: SleepRecordLike[], count: number, threshold: number): boolean {
  const latest = getLastValidRecords(records, count);
  return latest.length === count && latest.every((record) => {
    const score = safeScore(record.scoreTotal);
    return score !== null && score < threshold;
  });
}

function hasConsecutiveLowEnergy(records: SleepRecordLike[], count: number): boolean {
  const latest = sortRecordsDesc(records).filter((record) => normalizeLocalDate(record.date) !== null).slice(0, count);
  return latest.length === count && latest.every((record) => isValidNumber(record.energy) && record.energy <= 1);
}

function hasNotRegisteredForThreeDays(student: StudentLike, reference = new Date()): boolean {
  const latest = getLatestRecord(student.sleepRecords ?? []);
  const date = normalizeLocalDate(latest?.date);
  if (!date) return false;
  return daysBetweenDateOnly(date, getLocalTodayString(reference)) >= 3;
}

export function generateTeacherAlerts(student: StudentLike, reference = new Date()): TeacherAlert[] {
  const rawStudentId = Number(student.id);
  const studentId = Number.isFinite(rawStudentId) ? rawStudentId : String(student.id);
  const studentName = student.user?.name || student.name || 'Aluno';
  const records = student.sleepRecords ?? [];
  const alerts: TeacherAlert[] = [];

  const latestValid = getLastValidRecords(records, 1)[0];
  const latestScore = latestValid ? safeScore(latestValid.scoreTotal) : null;
  const averageLast7 = averageScores(getRecordsLastDays(records, 7, reference));
  const readinessScore = calculateReadinessScore(student);
  const fatigue = calculateFatigueRisk(student);
  const adherence = calculateLowAdherence(student, reference);
  const goalStatus = calculateGoalNotMet(student, reference);

  if (latestScore !== null && latestScore < 40) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'SCORE_CRITICO_ULTIMA_NOITE',
      title: 'Score crítico na última noite',
      message: `${studentName} registrou score abaixo de 40 na última noite.`,
      severity: 'critical',
      actionSuggestion: 'Entrar em contato e reduzir cobrança de intensidade no treino do dia.',
    }));
  }

  if (hasConsecutiveLowScores(records, 2, 55)) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'DUAS_NOITES_RUINS',
      title: 'Duas noites seguidas ruins',
      message: `${studentName} teve 2 registros consecutivos abaixo de 55.`,
      severity: 'high',
      actionSuggestion: 'Revisar rotina noturna e considerar ajuste temporário de volume/intensidade.',
    }));
  }

  if (averageLast7 !== null && averageLast7 < 55) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'MEDIA_SEMANAL_BAIXA',
      title: 'Média semanal baixa',
      message: `${studentName} está com média dos últimos 7 dias abaixo de 55.`,
      severity: 'high',
      actionSuggestion: 'Conversar sobre horários, telas, cafeína e consistência da rotina de sono.',
    }));
  }

  if (hasConsecutiveLowEnergy(records, 3)) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'SEM_ENERGIA_3_NOITES',
      title: 'Acordando sem energia há 3 registros',
      message: `${studentName} marcou energia 1 por 3 registros consecutivos.`,
      severity: 'high',
      actionSuggestion: 'Avaliar recuperação geral, carga semanal e sinais de fadiga acumulada.',
    }));
  }

  if (fatigue.value !== null && fatigue.value > 75) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'RISCO_FADIGA_ELEVADO',
      title: 'Risco de fadiga elevado',
      message: `${studentName} está com risco de fadiga acima de 75.`,
      severity: 'critical',
      actionSuggestion: 'Reduzir intensidade planejada e priorizar recuperação nas próximas sessões.',
    }));
  }

  if (readinessScore !== null && readinessScore < 50) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'PRONTIDAO_BAIXA_HOJE',
      title: 'Prontidão baixa hoje',
      message: `${studentName} está com prontidão abaixo de 50.`,
      severity: 'high',
      actionSuggestion: 'Adaptar treino do dia para uma sessão moderada ou regenerativa.',
    }));
  }

  if (goalStatus.isSevereDeficit) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'DEFICIT_SEVERO_SONO',
      title: 'Déficit severo de sono',
      message: `${studentName} dormiu, em média, mais de 1h abaixo da meta ativa.`,
      severity: 'high',
      actionSuggestion: 'Revisar meta, rotina e barreiras reais para aumentar horas de sono.',
    }));
  }

  if (hasNotRegisteredForThreeDays(student, reference)) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'SEM_REGISTRAR_3_DIAS',
      title: 'Sem registrar há 3 dias',
      message: `${studentName} ficou 3 dias consecutivos sem registrar sono.`,
      severity: 'high',
      actionSuggestion: 'Enviar lembrete direto e simples para retomar o acompanhamento.',
    }));
  }

  if (adherence.isLowAdherence) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'BAIXA_ADESAO_SEMANAL',
      title: 'Baixa adesão semanal',
      message: `${studentName} fez menos de 3 registros nos últimos 7 dias.`,
      severity: 'moderate',
      actionSuggestion: 'Reforçar a importância do registro diário, sem aumentar cobrança desnecessária.',
    }));
  }

  const fatigueHighOrElevated = fatigue.level === 'alto' || fatigue.level === 'elevado';
  const needsContactFactors = [fatigueHighOrElevated, adherence.isLowAdherence, goalStatus.isGoalNotMet || goalStatus.isSevereDeficit].filter(Boolean).length;
  if (needsContactFactors >= 2) {
    alerts.push(createTeacherAlert({
      studentId,
      studentName,
      type: 'NECESSITA_CONTATO_PROFESSOR',
      title: 'Necessita contato do professor',
      message: `${studentName} acumulou pelo menos 2 fatores críticos: fadiga, adesão baixa ou meta ruim.`,
      severity: 'critical',
      actionSuggestion: 'Entrar em contato e combinar uma ação objetiva para as próximas 24–48h.',
    }));
  }

  return alerts;
}

function serializeDate(value: unknown): string | null {
  const date = safeDate(value);
  return date ? date.toISOString() : null;
}

export function mapSleepRecordForTeacher(record: SleepRecordLike | null | undefined) {
  if (!record) return null;
  return {
    id: record.id,
    date: serializeDate(record.date),
    sleepStart: serializeDate(record.sleepTime),
    sleepEnd: serializeDate(record.wakeTime),
    sleepHours: isValidNumber(record.totalHours) ? record.totalHours : null,
    totalHours: isValidNumber(record.totalHours) ? record.totalHours : null,
    score: safeScore(record.scoreTotal),
    scoreTotal: safeScore(record.scoreTotal),
    scoreDuration: isValidNumber(record.scoreDuration) ? record.scoreDuration : null,
    scoreQuality: isValidNumber(record.scoreQuality) ? record.scoreQuality : null,
    scoreContinuity: isValidNumber(record.scoreContinuity) ? record.scoreContinuity : null,
    scoreState: isValidNumber(record.scoreState) ? record.scoreState : null,
    scoreRegularity: isValidNumber(record.scoreRegularity) ? record.scoreRegularity : null,
    classification: record.classification ?? null,
    perceivedQuality: isValidNumber(record.perceivedQuality) ? record.perceivedQuality : null,
    awakenings: isValidNumber(record.awakenings) ? record.awakenings : null,
    wakeState: isValidNumber(record.morningState) ? record.morningState : null,
    morningState: isValidNumber(record.morningState) ? record.morningState : null,
    energy: isValidNumber(record.energy) ? record.energy : null,
    mood: isValidNumber(record.mood) ? record.mood : null,
    stress: isValidNumber(record.stress) ? record.stress : null,
    generalPain: isValidNumber(record.generalPain) ? record.generalPain : null,
    bodyHeaviness: isValidNumber(record.bodyHeaviness) ? record.bodyHeaviness : null,
    sleepLatencyMinutes: isValidNumber(record.timeToSleep) ? record.timeToSleep : null,
    timeToSleep: isValidNumber(record.timeToSleep) ? record.timeToSleep : null,
    nap: typeof record.nap === 'boolean' ? record.nap : null,
    caffeine: typeof record.caffeine === 'boolean' ? record.caffeine : null,
    alcohol: typeof record.alcohol === 'boolean' ? record.alcohol : null,
    screenBeforeSleep: typeof record.screenBeforeSleep === 'boolean' ? record.screenBeforeSleep : null,
    pain: typeof record.pain === 'boolean' ? record.pain : null,
    notes: record.notes ?? null,
    createdAt: serializeDate(record.createdAt),
  };
}

export function mapSleepGoal(goal: SleepGoalLike | null | undefined) {
  if (!goal) return null;
  return {
    ...goal,
    id: goal.id,
    studentId: goal.studentId,
    hoursGoal: isValidNumber(goal.hoursGoal) ? goal.hoursGoal : null,
    sleepTimeGoal: serializeDate(goal.sleepTimeGoal),
    wakeTimeGoal: serializeDate(goal.wakeTimeGoal),
    regularityGoal: isValidNumber(goal.regularityGoal) ? goal.regularityGoal : null,
    active: goal.active !== false,
    createdAt: serializeDate(goal.createdAt),
  };
}

export function buildTeacherDashboardSummary(students: StudentLike[], reference = new Date()) {
  const builtStudents = students.map((student) => {
    const rawStudentId = Number(student.id);
    const normalizedStudentId = Number.isFinite(rawStudentId) ? rawStudentId : student.id;
    const records = student.sleepRecords ?? [];
    const recentRecords = sortRecordsDesc(records).slice(0, 30);
    const recordsLast7Days = getRecordsLastDays(records, 7, reference);
    const lastRecord = getLatestRecord(records);
    const activeSleepGoal = getActiveGoal(student);
    const lastThree = getLastValidRecords(records, 3);
    const indicatorInput = [...lastThree].reverse();
    const dailyIndicators = calculateDailyIndicators(indicatorInput as any);
    const lastSevenValid = getRecordsLastDays(records, 7, reference).filter((record) => safeScore(record.scoreTotal) !== null);
    const fatigue = calculateFatigueRisk(student);
    const adherence = calculateLowAdherence(student, reference);
    const goalStatus = calculateGoalNotMet(student, reference);
    const alerts = generateTeacherAlerts(student, reference);
    const latestValidScoreRecord = getLastValidRecords(records, 1)[0];

    return {
      id: normalizedStudentId,
      name: student.user?.name || student.name || '',
      email: student.user?.email || student.email || '',
      login: student.user?.login || student.login || undefined,
      username: student.user?.username || student.username || undefined,
      lastRecord: mapSleepRecordForTeacher(lastRecord),
      recentRecords: recentRecords.map(mapSleepRecordForTeacher),
      recordsLast7Days: recordsLast7Days.map(mapSleepRecordForTeacher),
      activeSleepGoal: mapSleepGoal(activeSleepGoal),
      averageLast3Score: averageScores(lastThree),
      averageLast7Score: averageScores(lastSevenValid),
      averageSleepHoursLast7Days: averageSleepHours(recordsLast7Days),
      readinessScore: dailyIndicators.readinessScore,
      readinessClassification: dailyIndicators.readinessClassification,
      recovery: dailyIndicators.recovery,
      fatigue: dailyIndicators.fatigue,
      alertness: dailyIndicators.alertness,
      mentalFocus: dailyIndicators.mentalFocus,
      overloadRisk: dailyIndicators.overloadRisk,
      generalStatusScore: dailyIndicators.generalStatusScore,
      generalStatusClassification: dailyIndicators.generalStatusClassification,
      generalStatus: dailyIndicators.generalStatus,
      indicatorTrend: dailyIndicators.trend,
      fatigueRisk: fatigue.value,
      fatigueRiskLevel: fatigue.level,
      registeredToday: records.some((record) => isExpectedSleepCheckInRecordDate(record.date, reference)),
      isRiskStudent: calculateRiskStudent(student),
      isLowAdherence: adherence.isLowAdherence,
      isCriticalAdherence: adherence.isCriticalAdherence,
      isGoalNotMet: goalStatus.isGoalNotMet,
      isSevereSleepDeficit: goalStatus.isSevereDeficit,
      latestValidScore: latestValidScoreRecord ? safeScore(latestValidScoreRecord.scoreTotal) : null,
      latestRecordDate: normalizeLocalDate(latestValidScoreRecord?.date),
      alerts,
    };
  });

  const topWorstRecoveries = builtStudents
    .filter((student) => student.averageLast3Score !== null)
    .sort((a, b) => (a.averageLast3Score ?? 101) - (b.averageLast3Score ?? 101))
    .slice(0, 3)
    .map((student) => ({
      studentId: student.id,
      studentName: student.name,
      averageLast3Score: student.averageLast3Score as number,
      latestScore: student.latestValidScore,
      latestRecordDate: student.latestRecordDate,
    }));

  return {
    totalStudents: builtStudents.length,
    registeredToday: builtStudents.filter((student) => student.registeredToday).length,
    riskStudents: builtStudents.filter((student) => student.isRiskStudent).length,
    lowAdherenceStudents: builtStudents.filter((student) => student.isLowAdherence).length,
    criticalAdherenceStudents: builtStudents.filter((student) => student.isCriticalAdherence).length,
    fatigueRiskStudents: builtStudents.filter((student) => student.fatigueRisk !== null && student.fatigueRisk > 75).length,
    goalNotMetStudents: builtStudents.filter((student) => student.isGoalNotMet).length,
    studentsWithAlerts: builtStudents.filter((student) => student.alerts.length > 0).length,
    totalActiveAlerts: builtStudents.reduce((sum, student) => sum + student.alerts.length, 0),
    topWorstRecoveries,
    students: builtStudents.map(({ latestValidScore, latestRecordDate, isSevereSleepDeficit, ...student }) => ({
      ...student,
      isSevereSleepDeficit,
    })),
  };
}
