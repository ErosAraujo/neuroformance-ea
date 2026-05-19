import { SleepRecordLike } from '../types/sleepRecord';
import { calculateDailyIndicators, DailyIndicatorsResult } from './indicatorService';

export type InsightSeverity = 'positive' | 'neutral' | 'attention' | 'warning' | 'critical';
export type InsightPriority = 'low' | 'medium' | 'high' | 'critical';
export type InsightAudience = 'student' | 'teacher' | 'both';
export type InsightSource = 'sleep_record' | 'weekly_summary' | 'history' | 'chart' | 'alert' | 'manual';

export interface Insight {
  id: string;
  title: string;
  message: string;
  description: string;
  category: string;
  audience: InsightAudience;
  screen: string;
  severity: InsightSeverity;
  level: 'positive' | 'neutral' | 'warning';
  priority: InsightPriority;
  source: InsightSource;
  triggerReason: string;
  recommendedAction?: string;
  createdAt: string;
}

export interface TeacherAlert {
  id: string;
  studentId: number | string;
  studentName: string;
  title: string;
  message: string;
  description: string;
  priority: 'medium' | 'high' | 'critical';
  severity: 'attention' | 'warning' | 'critical';
  level: 'warning' | 'danger';
  type: string;
  triggerReason: string;
  recommendedAction: string;
  action: string;
  status: 'active' | 'resolved' | 'ignored';
  createdAt: string;
  date: string;
  resolvedAt?: string;
}

export interface SleepGoalLike {
  hoursGoal?: number | null;
  sleepTimeGoal?: Date | string | null;
  wakeTimeGoal?: Date | string | null;
  regularityGoal?: number | null;
  active?: boolean | null;
}

export interface StudentProfileInsights {
  insufficientDataMessage?: string;
  blocks: Array<{ id: string; title: string; value?: string | number | null; message: string; severity: InsightSeverity; priority?: InsightPriority }>;
  sections: Record<string, Insight[]>;
  alerts: TeacherAlert[];
}

const DATA_MESSAGES = {
  none: 'Ainda não há registros suficientes para análise.',
  lessThanThree: 'Ainda precisamos de mais registros para gerar uma análise confiável.',
  fewWeek: 'A análise da semana pode estar limitada porque há poucos registros recentes.',
};

const nowIso = () => new Date().toISOString();
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const scoreOrNull = (value: unknown) => finite(value) && value >= 0 && value <= 100 ? value : null;
const dateOnly = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (direct) return direct;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
const msFromDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`).getTime();
const todayDateOnly = () => new Date().toISOString().slice(0, 10);
const daysAgoDateOnly = (days: number) => new Date(msFromDateOnly(todayDateOnly()) - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function sortAsc(records: SleepRecordLike[]) {
  return [...records].sort((a, b) => (dateOnly(a.date) || '').localeCompare(dateOnly(b.date) || ''));
}
function sortDesc(records: SleepRecordLike[]) { return sortAsc(records).reverse(); }
function validScoreRecords(records: SleepRecordLike[]) { return sortDesc(records).filter((record) => scoreOrNull(record.scoreTotal) !== null && dateOnly(record.date)); }
function takeLastValid(records: SleepRecordLike[], count: number) { return validScoreRecords(records).slice(0, count); }
function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => finite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}
function averageScore(records: SleepRecordLike[]) { return average(records.map((record) => scoreOrNull(record.scoreTotal))); }
function averageHours(records: SleepRecordLike[]) { return average(records.map((record) => finite(record.totalHours) ? record.totalHours : null)); }
function avgScale(records: SleepRecordLike[], field: keyof SleepRecordLike) { return average(records.map((record) => finite(record[field] as number) ? Number(record[field]) : null)); }
function recordsLastDays(records: SleepRecordLike[], days: number) {
  const from = daysAgoDateOnly(Math.max(0, days - 1));
  const to = todayDateOnly();
  return sortDesc(records).filter((record) => {
    const key = dateOnly(record.date);
    return Boolean(key && key >= from && key <= to);
  });
}
function previousDays(records: SleepRecordLike[], startDaysAgo: number, endDaysAgo: number) {
  const from = daysAgoDateOnly(startDaysAgo);
  const to = daysAgoDateOnly(endDaysAgo);
  return sortDesc(records).filter((record) => {
    const key = dateOnly(record.date);
    return Boolean(key && key >= from && key <= to);
  });
}
function latest(records: SleepRecordLike[]) { return validScoreRecords(records)[0] ?? sortDesc(records)[0] ?? null; }
function trendDiff(records: SleepRecordLike[]) {
  const asc = sortAsc(validScoreRecords(records));
  if (asc.length < 2) return 0;
  const first = scoreOrNull(asc[0].scoreTotal) ?? 0;
  const last = scoreOrNull(asc[asc.length - 1].scoreTotal) ?? first;
  return last - first;
}
function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}
function hasConsecutive(records: SleepRecordLike[], count: number, predicate: (record: SleepRecordLike) => boolean) {
  const desc = sortDesc(records);
  let streak = 0;
  for (const record of desc) {
    if (predicate(record)) streak += 1;
    else streak = 0;
    if (streak >= count) return true;
  }
  return false;
}
function daysSinceLatest(records: SleepRecordLike[]) {
  const last = latest(records);
  const key = dateOnly(last?.date);
  if (!key) return Number.POSITIVE_INFINITY;
  return Math.floor((msFromDateOnly(todayDateOnly()) - msFromDateOnly(key)) / (24 * 60 * 60 * 1000));
}
function classifyScore(score: number | null) {
  if (score === null) return 'sem dados';
  if (score >= 85) return 'excelente';
  if (score >= 70) return 'boa';
  if (score >= 55) return 'atenção moderada';
  if (score >= 40) return 'baixa';
  return 'crítica';
}
function riskLevel(value: number | null) {
  if (value === null) return 'dados insuficientes';
  if (value >= 85) return 'crítico';
  if (value >= 75) return 'alto';
  if (value >= 55) return 'moderado';
  return 'baixo';
}
function positiveSeverity(value: number | null): InsightSeverity {
  if (value === null) return 'neutral';
  if (value >= 70) return 'positive';
  if (value >= 55) return 'attention';
  if (value >= 40) return 'warning';
  return 'critical';
}
function negativeSeverity(value: number | null): InsightSeverity {
  if (value === null) return 'neutral';
  if (value >= 85) return 'critical';
  if (value >= 70) return 'warning';
  if (value >= 55) return 'attention';
  return 'positive';
}
function insightLevel(severity: InsightSeverity): 'positive' | 'neutral' | 'warning' {
  if (severity === 'positive') return 'positive';
  if (severity === 'neutral') return 'neutral';
  return 'warning';
}
function priorityFromSeverity(severity: InsightSeverity): InsightPriority {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'high';
  if (severity === 'attention') return 'medium';
  return 'low';
}
function makeInsight(args: Omit<Insight, 'description' | 'level' | 'priority' | 'createdAt'> & { createdAt?: string; priority?: InsightPriority }): Insight {
  const priority = args.priority ?? priorityFromSeverity(args.severity);
  return {
    ...args,
    description: args.message,
    level: insightLevel(args.severity),
    priority,
    createdAt: args.createdAt ?? nowIso(),
  };
}
function insufficientInsight(screen: string, message: string): Insight {
  return makeInsight({
    id: `${screen}-dados-insuficientes`,
    title: 'Sem dados suficientes',
    message,
    category: 'adherence',
    audience: 'both',
    screen,
    severity: 'neutral',
    source: 'manual',
    triggerReason: 'Quantidade de registros abaixo da base mínima.',
    recommendedAction: 'Continuar registrando o sono diariamente.',
  });
}

export function getInsufficientDataMessage(records: SleepRecordLike[], scope: 'analysis' | 'week' = 'analysis') {
  const total = validScoreRecords(records).length;
  if (total === 0) return DATA_MESSAGES.none;
  if (total < 3) return DATA_MESSAGES.lessThanThree;
  if (scope === 'week' && recordsLastDays(records, 7).length < 5) return DATA_MESSAGES.fewWeek;
  return null;
}

export function calculateFatigueRiskOfficial(records: SleepRecordLike[]) {
  const lastThree = sortAsc(takeLastValid(records, 3));
  if (lastThree.length < 3) return null;
  const avg = averageScore(lastThree);
  const oldest = scoreOrNull(lastThree[0].scoreTotal);
  const newest = scoreOrNull(lastThree[lastThree.length - 1].scoreTotal);
  const energy = finite(lastThree[lastThree.length - 1].energy) ? Number(lastThree[lastThree.length - 1].energy) : null;
  if (avg === null || oldest === null || newest === null || energy === null) return null;
  const scoreRisk = 100 - avg;
  const trendRisk = clamp(((oldest - newest) / 20) * 100, 0, 100);
  const energyRisk = clamp(((5 - energy) / 4) * 100, 0, 100);
  return round(scoreRisk * 0.5 + trendRisk * 0.3 + energyRisk * 0.2, 1);
}


function indicatorWindow(records: SleepRecordLike[]) {
  return calculateDailyIndicators(sortAsc(takeLastValid(records, 3)) as any);
}
function fatigueValueForWindow(records: SleepRecordLike[]) {
  return indicatorWindow(records).fatigue.value;
}
function overloadValueForWindow(records: SleepRecordLike[]) {
  const official = calculateFatigueRiskOfficial(records);
  return official ?? indicatorWindow(records).overloadRisk.value;
}
function latestSlidingWindow(sortedDescRecords: SleepRecordLike[], startIndex: number, size = 3) {
  return sortDesc(sortedDescRecords).slice(startIndex, startIndex + size);
}
function hasPersistentHighFatigue(records: SleepRecordLike[]) {
  const sorted = sortDesc(records);
  if (sorted.length < 2) return false;
  const newestWindow = latestSlidingWindow(sorted, 0, 3);
  const previousWindow = latestSlidingWindow(sorted, 1, 3);
  const newest = fatigueValueForWindow(newestWindow);
  const previous = fatigueValueForWindow(previousWindow);
  return (newest !== null && previous !== null && newest >= 75 && previous >= 75) || (newest !== null && newest >= 85);
}
function hasPersistentOverloadRisk(records: SleepRecordLike[]) {
  const sorted = sortDesc(records);
  if (sorted.length < 3) return false;
  const newestWindow = latestSlidingWindow(sorted, 0, 3);
  const previousWindow = latestSlidingWindow(sorted, 1, 3);
  const newest = overloadValueForWindow(newestWindow);
  const previous = previousWindow.length >= 3 ? overloadValueForWindow(previousWindow) : null;
  const indicators = indicatorWindow(newestWindow);
  const combinedCurrentRisk = newest !== null && newest >= 75 && (indicators.fatigue.value ?? 0) >= 75 && (indicators.recovery.value ?? 100) < 55;
  return (newest !== null && previous !== null && newest >= 75 && previous >= 75) || combinedCurrentRisk || (newest !== null && newest >= 85);
}

export function buildPostRecordInsights(record: SleepRecordLike, allRecords: SleepRecordLike[], activeGoal?: SleepGoalLike | null): Insight[] {
  const sorted = sortDesc(allRecords.length ? allRecords : [record]);
  const recentBeforeCurrent = sorted.filter((item) => item.id !== record.id).slice(0, 7);
  const currentScore = scoreOrNull(record.scoreTotal);
  const recentAvg = averageScore(recentBeforeCurrent.slice(0, 3));
  const week = recordsLastDays(sorted, 7);
  const scoreValues = week.map((item) => scoreOrNull(item.scoreTotal)).filter((value): value is number => value !== null);
  const maxWeek = scoreValues.length ? Math.max(...scoreValues) : null;
  const minWeek = scoreValues.length ? Math.min(...scoreValues) : null;
  const indicators = calculateDailyIndicators(sortAsc(takeLastValid(sorted, 3)) as any);
  const risk = calculateFatigueRiskOfficial(sorted) ?? indicators.overloadRisk.value;
  const insights: Insight[] = [];

  insights.push(makeInsight({
    id: `post-record-saved-${record.id ?? dateOnly(record.date) ?? 'novo'}`,
    title: 'Registro salvo. Agora temos mais uma peça do seu padrão de recuperação.',
    message: 'Seu registro foi salvo e será usado para atualizar seus indicadores de sono, prontidão, recuperação e risco de fadiga.',
    category: 'sleep', audience: 'student', screen: 'student_post_record', severity: 'positive', source: 'sleep_record', triggerReason: 'Registro de sono salvo com sucesso.', recommendedAction: 'Acompanhar a leitura abaixo e manter o registro diário.',
  }));

  const candidates: Insight[] = [];
  if (sorted.length === 1) {
    candidates.push(makeInsight({ id: 'first-record-done', title: 'Primeiro registro concluído', message: 'Esse é o primeiro passo para entender seu padrão de sono e recuperação. Com mais registros, o app conseguirá identificar tendências reais e gerar análises mais precisas.', category: 'adherence', audience: 'student', screen: 'student_post_record', severity: 'positive', source: 'sleep_record', triggerReason: 'Primeiro registro do aluno.', recommendedAction: 'Registrar novamente amanhã para formar linha de base.' }));
  } else if (sorted.length < 3) {
    candidates.push(makeInsight({ id: 'more-records-needed', title: 'Ainda precisamos de mais registros', message: 'Com poucos registros, a análise ainda é limitada. Continue preenchendo diariamente para que o app compare seus dados e identifique padrões confiáveis.', category: 'adherence', audience: 'student', screen: 'student_post_record', severity: 'neutral', source: 'sleep_record', triggerReason: 'Menos de 3 registros válidos.', recommendedAction: 'Completar pelo menos 3 registros válidos.' }));
  }
  if (currentScore !== null && recentAvg !== null && currentScore >= recentAvg + 5) candidates.push(makeInsight({ id: 'score-above-recent-average', title: 'Seu score ficou acima da média recente', message: 'O registro de hoje ficou melhor que sua média recente. Isso pode indicar uma noite mais restauradora, melhor recuperação ou melhora na rotina de sono.', category: 'comparison', audience: 'student', screen: 'student_post_record', severity: 'positive', source: 'sleep_record', triggerReason: `Score ${currentScore} acima da média recente ${round(recentAvg)}.`, recommendedAction: 'Observar quais hábitos ajudaram neste resultado.' }));
  if (currentScore !== null && recentAvg !== null && currentScore <= recentAvg - 5) candidates.push(makeInsight({ id: 'score-below-recent-average', title: 'Seu score caiu em relação à sua média recente', message: 'O registro de hoje ficou abaixo do seu padrão recente. Vale observar se houve sono mais curto, mais despertares, maior estresse ou baixa energia ao acordar.', category: 'comparison', audience: 'student', screen: 'student_post_record', severity: 'attention', source: 'sleep_record', triggerReason: `Score ${currentScore} abaixo da média recente ${round(recentAvg)}.`, recommendedAction: 'Controlar intensidade e acompanhar o próximo registro.' }));
  if (currentScore !== null && maxWeek !== null && currentScore === maxWeek && week.length >= 2) candidates.push(makeInsight({ id: 'best-week-record', title: 'Melhor registro dos últimos 7 dias', message: 'Este foi seu melhor registro recente. Observe o que pode ter contribuído para essa melhora: horário de dormir, qualidade do sono, menor estresse ou melhor energia ao acordar.', category: 'comparison', audience: 'student', screen: 'student_post_record', severity: 'positive', source: 'sleep_record', triggerReason: 'Maior score dos últimos 7 dias.', recommendedAction: 'Repetir os comportamentos que antecederam esta noite.' }));
  if (currentScore !== null && minWeek !== null && currentScore === minWeek && week.length >= 2) candidates.push(makeInsight({ id: 'lowest-week-record', title: 'Registro mais baixo dos últimos 7 dias', message: 'Este foi seu registro mais baixo da semana. Isso não significa fracasso, mas indica atenção aos fatores que podem ter prejudicado sua recuperação.', category: 'comparison', audience: 'student', screen: 'student_post_record', severity: currentScore < 40 ? 'critical' : 'warning', source: 'sleep_record', triggerReason: 'Menor score dos últimos 7 dias.', recommendedAction: 'Evitar treino intenso e priorizar recuperação.' }));

  const goalHours = activeGoal?.hoursGoal;
  if (finite(goalHours) && finite(record.totalHours) && record.totalHours < goalHours) candidates.push(makeInsight({ id: 'sleep-below-goal', title: 'Sono abaixo do ideal', message: 'Você dormiu menos do que sua meta ou abaixo do seu padrão recente. Isso pode reduzir energia, foco, recuperação corporal e tolerância a treinos intensos.', category: 'sleep', audience: 'student', screen: 'student_post_record', severity: record.totalHours < goalHours - 1 ? 'warning' : 'attention', source: 'sleep_record', triggerReason: `Sono ${round(record.totalHours, 2)}h abaixo da meta ${goalHours}h.`, recommendedAction: 'Evitar adicionar intensidade sem necessidade.' }));
  if (finite(record.totalHours) && recentAvg !== null && currentScore !== null && record.totalHours >= 8 && currentScore < 55) candidates.push(makeInsight({ id: 'long-sleep-low-recovery', title: 'Mais horas de sono, mas baixa recuperação', message: 'Você dormiu por mais tempo, mas seus indicadores ainda apontam baixa recuperação. Isso pode indicar sono pouco restaurador, fadiga acumulada, estresse ou despertares relevantes.', category: 'recovery', audience: 'student', screen: 'student_post_record', severity: 'warning', source: 'sleep_record', triggerReason: 'Sono longo com score abaixo de 55.', recommendedAction: 'Observar despertares, estresse e energia ao acordar.' }));
  if (record.awakenings >= 3) candidates.push(makeInsight({ id: 'awakenings-affected-recovery', title: 'Despertares podem ter afetado sua recuperação', message: 'Você relatou muitos despertares durante a noite. Isso pode fragmentar o sono e reduzir a sensação de recuperação ao acordar.', category: 'sleep', audience: 'student', screen: 'student_post_record', severity: 'attention', source: 'sleep_record', triggerReason: `${record.awakenings} despertares relatados.`, recommendedAction: 'Registrar se houve tela, estresse, álcool ou desconforto.' }));
  if (record.perceivedQuality <= 2) candidates.push(makeInsight({ id: 'low-perceived-quality', title: 'Qualidade percebida abaixo do ideal', message: 'Sua percepção de qualidade do sono ficou baixa. Isso pode indicar que a noite não foi restauradora, mesmo que a duração pareça suficiente.', category: 'sleep', audience: 'student', screen: 'student_post_record', severity: 'attention', source: 'sleep_record', triggerReason: 'Qualidade percebida abaixo de 3.', recommendedAction: 'Controlar treino e buscar rotina mais previsível hoje.' }));
  if (record.energy >= 4) candidates.push(makeInsight({ id: 'good-morning-energy', title: 'Boa energia ao acordar', message: 'Você relatou boa energia ao acordar. Esse é um sinal positivo de recuperação e pode favorecer melhor disposição para o treino e para o dia.', category: 'recovery', audience: 'student', screen: 'student_post_record', severity: 'positive', source: 'sleep_record', triggerReason: 'Energia ao acordar alta.', recommendedAction: 'Manter hábitos que precederam essa noite.' }));
  if (record.energy <= 2) candidates.push(makeInsight({ id: 'low-morning-energy', title: 'Baixa energia ao acordar', message: 'Você relatou pouca energia ao acordar. Isso pode indicar sono pouco restaurador, fadiga acumulada ou necessidade de controlar a intensidade do treino.', category: 'fatigue', audience: 'student', screen: 'student_post_record', severity: 'warning', source: 'sleep_record', triggerReason: 'Energia ao acordar baixa.', recommendedAction: 'Evitar treino até a falha e observar resposta do corpo.' }));
  if (finite(record.stress) && record.stress >= 4) candidates.push(makeInsight({ id: 'high-stress-recovery-impact', title: 'Estresse elevado pode afetar sua recuperação', message: 'Seu nível de estresse ficou alto neste registro. Isso pode influenciar sono, recuperação corporal, foco mental e fadiga geral.', category: 'mental_focus', audience: 'student', screen: 'student_post_record', severity: 'attention', source: 'sleep_record', triggerReason: 'Estresse 4 ou 5.', recommendedAction: 'Reduzir estímulos extras e preservar recuperação.' }));
  if (indicators.fatigue.value !== null && indicators.fatigue.value >= 70) candidates.push(makeInsight({ id: 'high-fatigue-record', title: 'Fadiga elevada neste registro', message: 'Seus dados indicam fadiga acima do ideal. Hoje pode ser melhor controlar volume, intensidade e evitar treinos até a falha.', category: 'fatigue', audience: 'student', screen: 'student_post_record', severity: negativeSeverity(indicators.fatigue.value), source: 'sleep_record', triggerReason: `Fadiga em ${indicators.fatigue.value}/100.`, recommendedAction: 'Controlar volume, intensidade e evitar falha muscular.' }));
  if (risk !== null && risk >= 70) candidates.push(makeInsight({ id: 'overload-risk-attention-today', title: 'Atenção ao risco de sobrecarga hoje', message: 'Os dados deste registro indicam maior risco de sobrecarga. Evite aumentar carga, treinar até a falha ou acumular estímulos intensos sem necessidade.', category: 'overload_risk', audience: 'student', screen: 'student_post_record', severity: negativeSeverity(risk), source: 'sleep_record', triggerReason: `Risco calculado em ${risk}/100.`, recommendedAction: 'Não buscar recorde hoje. Controlar a sessão.' }));
  if (currentScore !== null && currentScore >= 70 && (indicators.recovery.value ?? currentScore) >= 70) candidates.push(makeInsight({ id: 'good-recovery-signal-today', title: 'Bom sinal de recuperação hoje', message: 'Seu registro indica boa recuperação geral. Mantenha os hábitos que contribuíram para esse resultado e siga observando sua resposta ao treino.', category: 'recovery', audience: 'student', screen: 'student_post_record', severity: 'positive', source: 'sleep_record', triggerReason: 'Score e recuperação em faixa boa.', recommendedAction: 'Seguir treino planejado com técnica e controle.' }));
  if (currentScore !== null && currentScore >= 40 && currentScore < 70) candidates.push(makeInsight({ id: 'record-attention-zone', title: 'Registro em zona de atenção', message: 'Seu resultado não está crítico, mas mostra pontos que merecem cuidado. Controle intensidade, observe sinais do corpo e acompanhe os próximos registros.', category: 'readiness', audience: 'student', screen: 'student_post_record', severity: currentScore < 55 ? 'warning' : 'attention', source: 'sleep_record', triggerReason: 'Score entre 40 e 69.', recommendedAction: 'Treinar com controle e acompanhar sinais do corpo.' }));
  if (currentScore !== null && currentScore < 40) candidates.push(makeInsight({ id: 'record-critical-zone', title: 'Registro em zona crítica', message: 'Seu registro ficou em uma faixa crítica. Evite treino intenso hoje e priorize recuperação, sono, hidratação e atividades leves.', category: 'readiness', audience: 'student', screen: 'student_post_record', severity: 'critical', source: 'sleep_record', triggerReason: 'Score abaixo de 40.', recommendedAction: 'Priorizar recuperação e evitar treino intenso.' }));

  const selected = candidates.sort((a, b) => ({ critical: 0, warning: 1, attention: 2, positive: 3, neutral: 4 }[a.severity] - { critical: 0, warning: 1, attention: 2, positive: 3, neutral: 4 }[b.severity])).slice(0, 3);
  const final = makeInsight({
    id: 'what-to-do-now',
    title: 'O que fazer agora',
    message: currentScore === null ? 'Continue registrando para receber uma recomendação mais confiável.' : currentScore >= 70 ? 'Boa condição: siga o treino planejado, mantendo técnica e controle.' : currentScore >= 55 ? 'Atenção moderada: treine com controle e evite aumentar intensidade sem necessidade.' : currentScore >= 40 ? 'Baixa recuperação: reduza intensidade e volume hoje.' : 'Crítico: priorize recuperação, hidratação, sono e atividades leves.',
    category: 'teacher_action', audience: 'student', screen: 'student_post_record', severity: currentScore === null ? 'neutral' : positiveSeverity(currentScore), source: 'sleep_record', triggerReason: 'Recomendação final baseada no score do registro salvo.', recommendedAction: currentScore !== null && currentScore >= 70 ? 'Seguir treino planejado.' : currentScore !== null && currentScore >= 55 ? 'Treinar com controle.' : currentScore !== null && currentScore >= 40 ? 'Reduzir intensidade.' : 'Priorizar recuperação.',
  });
  return [insights[0], ...selected, final];
}


function scaleLabel(value: number | null, goodHigh = true) {
  if (value === null) return 'dados insuficientes';
  if (goodHigh) {
    if (value >= 85) return 'excelente';
    if (value >= 70) return 'boa';
    if (value >= 55) return 'moderada';
    if (value >= 40) return 'baixa';
    return 'crítica';
  }
  if (value >= 85) return 'crítica';
  if (value >= 70) return 'alta';
  if (value >= 55) return 'moderada';
  return 'baixa';
}
function weekStartDateOnly(value: unknown) {
  const key = dateOnly(value);
  if (!key) return null;
  const date = new Date(`${key}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}
function weeklyScoreAverages(records: SleepRecordLike[]) {
  const groups = new Map<string, number[]>();
  validScoreRecords(records).forEach((record) => {
    const key = weekStartDateOnly(record.date);
    const score = scoreOrNull(record.scoreTotal);
    if (!key || score === null) return;
    const list = groups.get(key) ?? [];
    list.push(score);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .map(([week, values]) => ({ week, average: values.reduce((sum, value) => sum + value, 0) / values.length, count: values.length }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
function scoreComponentMessage(records: SleepRecordLike[]) {
  const avgDuration = average(records.map((r) => finite(r.scoreDuration) ? Number(r.scoreDuration) : null));
  const avgQuality = average(records.map((r) => finite(r.scoreQuality) ? Number(r.scoreQuality) : null));
  const avgContinuity = average(records.map((r) => finite(r.scoreContinuity) ? Number(r.scoreContinuity) : null));
  const avgState = average(records.map((r) => finite(r.scoreState) ? Number(r.scoreState) : null));
  const avgRegularity = average(records.map((r) => finite(r.scoreRegularity) ? Number(r.scoreRegularity) : null));
  const parts = [
    `Sono ${avgDuration !== null ? round(avgDuration) : '—'}`,
    `Recuperação ${avgQuality !== null ? round(avgQuality) : '—'}`,
    `Estado mental ${avgState !== null ? round(avgState) : '—'}`,
    `Risco físico ${avgContinuity !== null || avgRegularity !== null ? round(average([avgContinuity, avgRegularity]) ?? 0) : '—'}`,
  ];
  return parts.join(' • ');
}

export function buildSleepInsights(currentWeek: SleepRecordLike[], previousWeek: SleepRecordLike[]): Insight[] {
  const current = sortDesc(currentWeek);
  const previous = sortDesc(previousWeek);
  const combined = sortDesc([...current, ...previous]);
  if (!current.length) {
    return [makeInsight({
      id: 'existing-no-week-records',
      title: 'Sem dados suficientes esta semana',
      message: 'Ainda não há registros suficientes nesta semana para gerar leitura confiável.',
      category: 'adherence', audience: 'student', screen: 'student_insights', severity: 'neutral', source: 'weekly_summary',
      triggerReason: 'Nenhum registro encontrado na semana atual.', recommendedAction: 'Registrar o sono diariamente para liberar análises semanais.',
    })];
  }
  const currentAvg = averageScore(current);
  const previousAvg = averageScore(previous);
  const indicators = calculateDailyIndicators(sortAsc(takeLastValid(combined.length ? combined : current, 3)) as any);
  const readiness = indicators.readinessScore;
  const recovery = indicators.recovery.value;
  const fatigue = indicators.fatigue.value;
  const alertness = indicators.alertness.value;
  const mentalFocus = indicators.mentalFocus.value;
  const fatigueRisk = calculateFatigueRiskOfficial(combined.length ? combined : current) ?? indicators.overloadRisk.value;
  const currentRegularity = average(current.map((r) => finite(r.scoreRegularity) ? Number(r.scoreRegularity) : null));
  const previousRegularity = average(previous.map((r) => finite(r.scoreRegularity) ? Number(r.scoreRegularity) : null));
  const currentHours = averageHours(current);
  const previousHours = averageHours(previous);
  const good = current.filter((r) => (scoreOrNull(r.scoreTotal) ?? 0) >= 70).length;
  const bad = current.filter((r) => (scoreOrNull(r.scoreTotal) ?? 100) < 55).length;
  const weekDiff = currentAvg !== null && previousAvg !== null ? currentAvg - previousAvg : null;
  const adherenceDiff = current.length - previous.length;
  const regularityDiff = currentRegularity !== null && previousRegularity !== null ? currentRegularity - previousRegularity : null;
  const sleepDiff = currentHours !== null && previousHours !== null ? currentHours - previousHours : null;
  const loadDecision = readiness === null || recovery === null || fatigue === null
    ? 'Ainda precisamos de base maior para definir carga com segurança.'
    : readiness >= 70 && recovery >= 70 && fatigue < 70
      ? 'Seu corpo parece apto para receber carga com controle técnico.'
      : readiness >= 55 && recovery >= 55
        ? 'Seu corpo pode receber treino, mas sem progressão agressiva.'
        : 'Seu corpo pede redução de carga ou foco em recuperação.';
  const conduct = readiness === null ? 'Treino com controle' : readiness >= 70 && (fatigue ?? 0) < 70 ? 'Treino liberado' : readiness >= 55 ? 'Treino com controle' : readiness >= 40 ? 'Treino regenerativo' : 'Evitar treino intenso';
  const make = (id: string, title: string, message: string, category: string, severity: InsightSeverity, recommendedAction?: string) => makeInsight({ id, title, message, category, audience: 'student', screen: 'student_insights', severity, source: 'weekly_summary', triggerReason: title, recommendedAction });
  const insights: Insight[] = [
    make('existing-recovery-load-level', 'Seu corpo está pronto para receber carga?', loadDecision, 'readiness', positiveSeverity(average([readiness, recovery])), conduct),
    make('existing-training-conduct', 'Conduta sugerida para hoje', `${conduct}. Essa conduta considera prontidão, recuperação, fadiga e risco acumulado.`, 'teacher_action', conduct === 'Treino liberado' ? 'positive' : conduct === 'Treino com controle' ? 'attention' : conduct === 'Treino regenerativo' ? 'warning' : 'critical', conduct),
    make('existing-readiness-today', 'Prontidão para treinar hoje', readiness === null ? DATA_MESSAGES.lessThanThree : `Prontidão em ${readiness}/100, faixa ${scaleLabel(readiness)}.`, 'readiness', positiveSeverity(readiness), readiness !== null && readiness >= 70 ? 'Seguir plano com controle.' : 'Ajustar estímulo conforme resposta do corpo.'),
    make('existing-fatigue-risk', 'Risco de fadiga acumulada', fatigueRisk === null ? DATA_MESSAGES.lessThanThree : `Risco em ${fatigueRisk}/100, nível ${riskLevel(fatigueRisk)}.`, 'fatigue', negativeSeverity(fatigueRisk), fatigueRisk !== null && fatigueRisk >= 75 ? 'Reduzir volume/intensidade e monitorar sinais.' : 'Manter acompanhamento.'),
    make('existing-body-recovery', 'Recuperação corporal', recovery === null ? DATA_MESSAGES.lessThanThree : `Recuperação corporal em ${recovery}/100, faixa ${scaleLabel(recovery)}.`, 'recovery', positiveSeverity(recovery)),
    make('existing-register-consistency', 'Consistência de registros', current.length >= 5 ? 'Alta adesão: 5 a 7 registros recentes.' : current.length >= 3 ? 'Moderada: 3 a 4 registros recentes.' : current.length >= 1 ? 'Baixa: 1 a 2 registros recentes.' : 'Sem adesão: 0 registros recentes.', 'adherence', current.length >= 5 ? 'positive' : current.length >= 3 ? 'attention' : 'warning', 'Registrar diariamente para melhorar a precisão.'),
    make('existing-score-breakdown', 'O que formou seu score?', scoreComponentMessage(current), 'sleep', 'neutral', 'Comparar sono, recuperação, estado mental e risco físico antes de decidir carga.'),
    make('existing-score-guide', 'Como interpretar seu score', '85 a 100: excelente prontidão. 70 a 84: boa. 55 a 69: atenção moderada. 40 a 54: baixa. 0 a 39: crítico.', 'readiness', 'neutral'),
    make('existing-no-week-data', 'Sem dados suficientes esta semana', current.length < 3 ? DATA_MESSAGES.lessThanThree : 'Há registros suficientes para uma leitura semanal inicial.', 'adherence', current.length < 3 ? 'neutral' : 'positive'),
    make('existing-positive-sleep-evolution', 'Evolução positiva do sono', weekDiff !== null && weekDiff >= 5 ? `Sua média subiu ${round(weekDiff)} pontos em relação à semana anterior.` : 'Não houve evolução positiva relevante em relação à semana anterior.', 'trend', weekDiff !== null && weekDiff >= 5 ? 'positive' : 'neutral'),
    make('existing-sleep-quality-drop', 'Queda na qualidade do sono', weekDiff !== null && weekDiff <= -5 ? `Sua média caiu ${round(Math.abs(weekDiff))} pontos em relação à semana anterior.` : 'Não houve queda relevante na qualidade do sono no comparativo semanal.', 'trend', weekDiff !== null && weekDiff <= -5 ? 'warning' : 'neutral'),
    make('existing-sleep-regularity-drop', 'Regularidade do sono caiu', regularityDiff !== null && regularityDiff <= -3 ? 'Seus horários/regularidade pioraram em relação à semana anterior.' : 'Não houve queda relevante na regularidade do sono.', 'trend', regularityDiff !== null && regularityDiff <= -3 ? 'attention' : 'neutral'),
    make('existing-register-regularity-drop', 'Regularidade de registros caiu', adherenceDiff < 0 ? `Você registrou ${Math.abs(adherenceDiff)} dia(s) a menos que na semana anterior.` : 'A regularidade de registros não caiu em relação à semana anterior.', 'adherence', adherenceDiff < 0 ? 'attention' : 'neutral'),
    make('existing-sleep-more-regular', 'Sono mais regular', regularityDiff !== null && regularityDiff >= 3 ? 'Seus horários/regularidade melhoraram em relação à semana anterior.' : 'Ainda não houve melhora clara na regularidade do sono.', 'trend', regularityDiff !== null && regularityDiff >= 3 ? 'positive' : 'neutral'),
    make('existing-registers-more-consistent', 'Registros mais consistentes', adherenceDiff > 0 ? `Você registrou ${adherenceDiff} dia(s) a mais que na semana anterior.` : 'A consistência de registros ainda não melhorou em relação à semana anterior.', 'adherence', adherenceDiff > 0 ? 'positive' : 'neutral'),
    make('existing-sleep-below-ideal', 'Sono abaixo do ideal', sleepDiff !== null && sleepDiff <= -0.5 ? `A média de horas caiu ${round(Math.abs(sleepDiff), 1)}h em relação à semana anterior.` : 'A duração do sono não caiu de forma relevante no período.', 'sleep', sleepDiff !== null && sleepDiff <= -0.5 ? 'attention' : 'neutral'),
    make('existing-sleep-above-pattern', 'Sono acima do padrão', sleepDiff !== null && sleepDiff >= 0.5 ? 'Você dormiu mais nesta semana. Se acordou bem, é bom sinal; se acordou cansado, pode indicar sono pouco restaurador ou fadiga acumulada.' : 'Não houve aumento relevante na duração média do sono.', 'sleep', sleepDiff !== null && sleepDiff >= 0.5 ? 'neutral' : 'neutral'),
    make('existing-good-recovery-sequence', 'Boa sequência de recuperação', good >= 4 ? `Você teve ${good} noite(s) em zona boa nos últimos registros.` : 'Ainda não há sequência positiva forte de recuperação.', 'recovery', good >= 4 ? 'positive' : 'neutral'),
    make('existing-attention-sequence', 'Sequência de atenção', bad >= 3 ? `Você teve ${bad} registros abaixo do ideal no período recente.` : 'Não há sequência relevante de registros ruins no período.', 'recovery', bad >= 3 ? 'warning' : 'neutral'),
    make('existing-stable-week', 'Semana estável', currentAvg !== null && Math.abs(weekDiff ?? 0) < 5 ? (currentAvg >= 70 ? 'Estável positiva: sem queda relevante e com recuperação em boa faixa.' : currentAvg >= 55 ? 'Estável moderada: sem grande variação, mas ainda com pontos de atenção.' : 'Estável baixa: sem queda brusca, mas abaixo do ideal.') : 'A semana não está estável; houve variação relevante.', 'trend', currentAvg !== null && Math.abs(weekDiff ?? 0) < 5 ? (currentAvg >= 70 ? 'positive' : currentAvg >= 55 ? 'attention' : 'warning') : 'attention'),
  ];
  if (alertness !== null || mentalFocus !== null) {
    insights.push(make('existing-focus-alertness-context', 'Estado de alerta e foco no contexto do score', `Estado de alerta ${alertness ?? '—'}/100 e foco mental ${mentalFocus ?? '—'}/100.`, 'mental_focus', positiveSeverity(average([alertness, mentalFocus]))));
  }
  return insights;
}

export function buildStudentInsightDashboard(records: SleepRecordLike[], activeGoal?: SleepGoalLike | null) {
  const week = recordsLastDays(records, 7);
  const previousWeek = previousDays(records, 13, 7);
  const all = sortDesc(records);
  const insufficient = getInsufficientDataMessage(all, 'week');
  const indicators: DailyIndicatorsResult = calculateDailyIndicators(sortAsc(takeLastValid(all, 3)) as any);
  const weeklyAvg = averageScore(week);
  const prevAvg = averageScore(previousWeek);
  const avgSleep = averageHours(week);
  const avgQuality = avgScale(week, 'perceivedQuality');
  const avgEnergy = avgScale(week, 'energy');
  const fatigueRisk = calculateFatigueRiskOfficial(all);
  const goalHours = activeGoal?.hoursGoal ?? null;
  const adherenceCount = week.length;
  const base = (id: string, title: string, message: string, category: string, severity: InsightSeverity, recommendedAction?: string) => makeInsight({ id, title, message, category, audience: 'student', screen: 'student_insights', severity, source: 'weekly_summary', triggerReason: title, recommendedAction });
  const insights = [
    base('weekly-summary', 'Resumo da semana atual', insufficient ?? `Sua média semanal está em ${weeklyAvg !== null ? round(weeklyAvg) : '—'} pontos, com ${adherenceCount} registro(s) nos últimos 7 dias.`, 'sleep', positiveSeverity(weeklyAvg), 'Manter registros diários para melhorar a precisão.'),
    base('week-comparison', 'Comparação com a semana anterior', prevAvg === null || weeklyAvg === null ? DATA_MESSAGES.lessThanThree : weeklyAvg >= prevAvg + 5 ? `Você melhorou ${round(weeklyAvg - prevAvg)} pontos em relação à semana anterior.` : weeklyAvg <= prevAvg - 5 ? `Você caiu ${round(prevAvg - weeklyAvg)} pontos em relação à semana anterior.` : 'A semana ficou estável em relação à anterior.', 'comparison', weeklyAvg !== null && prevAvg !== null && weeklyAvg < prevAvg - 5 ? 'attention' : 'neutral'),
    base('routine-consistency', 'Consistência da rotina', adherenceCount >= 5 ? 'Alta adesão: 5 a 7 registros na semana.' : adherenceCount >= 3 ? 'Adesão moderada: 3 a 4 registros na semana.' : adherenceCount >= 1 ? 'Baixa adesão: 1 a 2 registros na semana.' : 'Sem adesão: nenhum registro nos últimos 7 dias.', 'adherence', adherenceCount >= 5 ? 'positive' : adherenceCount >= 3 ? 'attention' : 'warning'),
    base('sleep-duration', 'Duração do sono', avgSleep === null ? DATA_MESSAGES.none : goalHours !== null ? `Média de ${round(avgSleep, 1)}h frente à meta de ${goalHours}h.` : `Média de ${round(avgSleep, 1)}h nos últimos registros.`, 'sleep', goalHours !== null && avgSleep !== null && avgSleep < goalHours - 1 ? 'warning' : 'neutral'),
    base('sleep-quality', 'Qualidade do sono', avgQuality === null ? DATA_MESSAGES.none : `Qualidade percebida média de ${round(avgQuality, 1)}/5.`, 'sleep', avgQuality !== null && avgQuality >= 4 ? 'positive' : avgQuality !== null && avgQuality < 3 ? 'attention' : 'neutral'),
    base('body-recovery', 'Recuperação corporal', indicators.recovery.value === null ? DATA_MESSAGES.lessThanThree : `Recuperação corporal em ${indicators.recovery.value}/100.`, 'recovery', positiveSeverity(indicators.recovery.value)),
    base('general-fatigue', 'Fadiga geral', indicators.fatigue.value === null ? DATA_MESSAGES.lessThanThree : `Fadiga geral em ${indicators.fatigue.value}/100.`, 'fatigue', negativeSeverity(indicators.fatigue.value)),
    base('focus-alertness', 'Foco e estado de alerta', indicators.alertness.value === null || indicators.mentalFocus.value === null ? DATA_MESSAGES.lessThanThree : `Estado de alerta em ${indicators.alertness.value}/100 e foco mental em ${indicators.mentalFocus.value}/100.`, 'mental_focus', positiveSeverity(average([indicators.alertness.value, indicators.mentalFocus.value]))),
    base('overload-risk', 'Risco de sobrecarga', fatigueRisk === null ? DATA_MESSAGES.lessThanThree : `Risco de fadiga/sobrecarga em ${fatigueRisk}/100: ${riskLevel(fatigueRisk)}.`, 'overload_risk', negativeSeverity(fatigueRisk)),
    base('registry-adherence', 'Adesão aos registros', `${adherenceCount}/7 registros na semana.`, 'adherence', adherenceCount >= 5 ? 'positive' : adherenceCount >= 3 ? 'attention' : 'warning'),
  ];
  const positives = insights.filter((item) => item.severity === 'positive');
  const warnings = insights.filter((item) => ['attention', 'warning', 'critical'].includes(item.severity));
  insights.push(base('weekly-strengths', 'Pontos fortes da semana', positives.length ? positives.slice(0, 2).map((item) => item.title).join(' • ') : 'Ainda não há ponto forte confiável destacado.', 'trend', positives.length ? 'positive' : 'neutral'));
  insights.push(base('weekly-attention-points', 'Pontos de atenção', warnings.length ? warnings.slice(0, 3).map((item) => item.title).join(' • ') : 'Nenhum ponto crítico ativo com os dados atuais.', 'trend', warnings.length ? 'attention' : 'positive'));
  insights.push(base('weekly-priority', 'Prioridade da semana', warnings[0]?.title ?? 'Manter consistência dos registros', 'teacher_action', warnings.length ? warnings[0].severity : 'positive'));
  insights.push(base('practical-recommendation', 'Recomendação prática', indicators.generalStatus || 'Continue registrando para calibrar a recomendação.', 'teacher_action', positiveSeverity(indicators.generalStatusScore)));
  insights.push(base('general-evolution', 'Evolução geral', trendDiff(week) >= 10 ? 'Evolução positiva no período.' : trendDiff(week) <= -10 ? 'Tendência de queda no período.' : 'Padrão estável no período.', 'trend', trendDiff(week) >= 10 ? 'positive' : trendDiff(week) <= -10 ? 'warning' : 'neutral'));
  const blocks = insights.map((item) => ({
    id: item.id,
    title: item.title,
    value: item.id === 'weekly-summary' ? (weeklyAvg !== null ? round(weeklyAvg) : null) : item.id === 'registry-adherence' ? `${adherenceCount}/7` : undefined,
    message: item.message,
    severity: item.severity,
    priority: item.priority,
  }));
  const existingInsights = buildSleepInsights(week, previousWeek);
  return { insufficientDataMessage: insufficient, indicators, blocks, insights: existingInsights };
}

export function buildHistoryInsights(records: SleepRecordLike[]): Insight[] {
  const all = sortDesc(records);
  if (!all.length) return [makeInsight({ id: 'history-dados-insuficientes', title: 'Histórico com dados insuficientes', message: DATA_MESSAGES.none, category: 'history', audience: 'student', screen: 'student_history', severity: 'neutral', source: 'history', triggerReason: 'Nenhum registro encontrado.', recommendedAction: 'Registrar o sono diariamente para formar histórico.' })];
  if (all.length < 3) return [makeInsight({ id: 'history-dados-insuficientes', title: 'Histórico com dados insuficientes', message: DATA_MESSAGES.lessThanThree, category: 'history', audience: 'student', screen: 'student_history', severity: 'neutral', source: 'history', triggerReason: 'Menos de 3 registros válidos.', recommendedAction: 'Completar pelo menos 3 registros válidos.' })];
  const valid = validScoreRecords(all);
  const asc = sortAsc(valid);
  const scores = valid.map((r) => scoreOrNull(r.scoreTotal)).filter((v): v is number => v !== null);
  const best = valid.reduce((acc, record) => (scoreOrNull(record.scoreTotal) ?? -1) > (scoreOrNull(acc?.scoreTotal) ?? -1) ? record : acc, valid[0]);
  const worst = valid.reduce((acc, record) => (scoreOrNull(record.scoreTotal) ?? 101) < (scoreOrNull(acc?.scoreTotal) ?? 101) ? record : acc, valid[0]);
  const diff = trendDiff(valid);
  const stdev = standardDeviation(scores);
  const make = (id: string, title: string, message: string, severity: InsightSeverity) => makeInsight({ id, title, message, category: 'history', audience: 'student', screen: 'student_history', severity, source: 'history', triggerReason: title });
  const firstHalf = asc.slice(0, Math.max(1, Math.floor(asc.length / 2)));
  const secondHalf = asc.slice(Math.max(1, Math.floor(asc.length / 2)));
  const firstReg = average(firstHalf.map((r) => finite(r.scoreRegularity) ? Number(r.scoreRegularity) : null));
  const secondReg = average(secondHalf.map((r) => finite(r.scoreRegularity) ? Number(r.scoreRegularity) : null));
  const regularityDiff = firstReg !== null && secondReg !== null ? secondReg - firstReg : null;
  const shortGood = valid.filter((record) => finite(record.totalHours) && record.totalHours < 6.5 && (scoreOrNull(record.scoreTotal) ?? 0) >= 70).length;
  const longLow = valid.filter((record) => finite(record.totalHours) && record.totalHours >= 8 && (scoreOrNull(record.scoreTotal) ?? 100) < 55).length;
  const wakeImpact = valid.filter((record) => record.awakenings >= 3 && (scoreOrNull(record.scoreTotal) ?? 100) < 55).length;
  const energyValues = valid.map((record) => finite(record.energy) ? Number(record.energy) : null).filter((v): v is number => v !== null);
  const insights: Insight[] = [
    make('history-best-record', 'Melhor registro do período', `Melhor score: ${scoreOrNull(best.scoreTotal) ?? '—'} em ${dateOnly(best.date) ?? 'data não identificada'}.`, 'positive'),
    make('history-lowest-record', 'Registro mais baixo do período', `Menor score: ${scoreOrNull(worst.scoreTotal) ?? '—'} em ${dateOnly(worst.date) ?? 'data não identificada'}.`, (scoreOrNull(worst.scoreTotal) ?? 100) < 40 ? 'critical' : 'attention'),
    make('history-positive-recovery-sequence', 'Sequência positiva de recuperação', hasConsecutive(valid, 3, (r) => (scoreOrNull(r.scoreTotal) ?? 0) >= 70) ? 'Há sequência recente de registros em zona boa.' : 'Ainda não há sequência de 3 registros bons consecutivos.', hasConsecutive(valid, 3, (r) => (scoreOrNull(r.scoreTotal) ?? 0) >= 70) ? 'positive' : 'neutral'),
    make('history-low-recovery-sequence', 'Sequência de baixa recuperação', hasConsecutive(valid, 3, (r) => (scoreOrNull(r.scoreTotal) ?? 100) < 55) ? 'Há sequência recente de registros abaixo do ideal.' : 'Não há sequência recente de 3 registros ruins consecutivos.', hasConsecutive(valid, 3, (r) => (scoreOrNull(r.scoreTotal) ?? 100) < 55) ? 'warning' : 'neutral'),
    make('history-period-positive-evolution', 'Evolução positiva no período', diff >= 10 ? 'Os registros mostram melhora relevante no período.' : 'Não houve evolução positiva relevante no período.', diff >= 10 ? 'positive' : 'neutral'),
    make('history-period-drop-trend', 'Tendência de queda no período', diff <= -10 ? 'Os registros mostram queda relevante no período.' : 'Não houve tendência de queda relevante no período.', diff <= -10 ? 'warning' : 'neutral'),
    make('history-stable-sleep-pattern', 'Padrão de sono estável', stdev < 15 ? 'O score manteve variação controlada.' : 'O padrão não está estável; houve alta oscilação.', stdev < 15 ? 'positive' : 'attention'),
    make('history-irregular-sleep-pattern', 'Padrão de sono irregular', stdev >= 15 ? 'O score oscilou bastante no período.' : 'Não há irregularidade alta no score do período.', stdev >= 15 ? 'attention' : 'neutral'),
    make('history-insufficient-data-reference', 'Histórico com dados insuficientes', valid.length < 5 ? 'A análise histórica ainda é limitada porque há poucos registros no período.' : 'Há base suficiente para uma leitura histórica inicial.', valid.length < 5 ? 'neutral' : 'positive'),
    make('history-short-sleep-good-response', 'Boa resposta mesmo com sono reduzido', shortGood > 0 ? 'Há registro com sono reduzido e boa recuperação. Isso pode indicar boa tolerância pontual, mas não deve virar regra.' : 'Não há evidência clara de boa resposta com sono reduzido.', shortGood > 0 ? 'positive' : 'neutral'),
    make('history-long-sleep-low-recovery', 'Sono longo com baixa recuperação', longLow > 0 ? 'Existem registros com muitas horas de sono, mas recuperação baixa.' : 'Não há padrão claro de sono longo com baixa recuperação.', longLow > 0 ? 'attention' : 'neutral'),
    make('history-awakenings-score-drop', 'Despertares associados à queda do score', wakeImpact >= 2 ? 'Registros com mais despertares aparecem junto de scores baixos.' : 'Não há associação forte entre despertares e queda do score no período.', wakeImpact >= 2 ? 'attention' : 'neutral'),
    make('history-regularity-improving', 'Regularidade em melhora', regularityDiff !== null && regularityDiff >= 3 ? 'A regularidade melhorou na segunda metade do período analisado.' : 'Ainda não há melhora clara de regularidade no período.', regularityDiff !== null && regularityDiff >= 3 ? 'positive' : 'neutral'),
    make('history-regularity-dropping', 'Regularidade em queda', regularityDiff !== null && regularityDiff <= -3 ? 'A regularidade caiu na segunda metade do período analisado.' : 'Não há queda relevante de regularidade no período.', regularityDiff !== null && regularityDiff <= -3 ? 'attention' : 'neutral'),
    make('history-unstable-morning-energy', 'Energia ao acordar instável', standardDeviation(energyValues) >= 1.2 ? 'A energia ao acordar oscilou de forma relevante.' : 'A energia ao acordar não teve oscilação relevante.', standardDeviation(energyValues) >= 1.2 ? 'attention' : 'neutral'),
  ];
  return insights;
}

export function buildChartInsights(records: SleepRecordLike[]): Insight[] {
  const valid = validScoreRecords(records);
  if (valid.length < 3) return [insufficientInsight('student_charts', valid.length === 0 ? DATA_MESSAGES.none : DATA_MESSAGES.lessThanThree)];
  const scores = valid.map((record) => scoreOrNull(record.scoreTotal)).filter((value): value is number => value !== null);
  const diff = trendDiff(valid);
  const stdev = standardDeviation(scores);
  const make = (id: string, title: string, message: string, category: string, severity: InsightSeverity) => makeInsight({ id, title, message, category, audience: 'student', screen: 'student_charts', severity, source: 'chart', triggerReason: title });
  const indicators = calculateDailyIndicators(sortAsc(takeLastValid(valid, 3)) as any);
  const weekly = weeklyScoreAverages(valid);
  let bestWeek: { week: string; diff: number } | null = null;
  let worstWeek: { week: string; diff: number } | null = null;
  for (let i = 1; i < weekly.length; i += 1) {
    const weekDiff = weekly[i].average - weekly[i - 1].average;
    if (!bestWeek || weekDiff > bestWeek.diff) bestWeek = { week: weekly[i].week, diff: weekDiff };
    if (!worstWeek || weekDiff < worstWeek.diff) worstWeek = { week: weekly[i].week, diff: weekDiff };
  }
  const hours = valid.map((r) => finite(r.totalHours) ? Number(r.totalHours) : null).filter((v): v is number => v !== null);
  const awakeningsImpact = valid.filter((r) => r.awakenings >= 3 && (scoreOrNull(r.scoreTotal) ?? 100) < 55).length;
  const stressImpact = valid.filter((r) => finite(r.stress) && Number(r.stress) >= 4 && (scoreOrNull(r.scoreTotal) ?? 100) < 55).length;
  const insights: Insight[] = [
    make('chart-positive-score-trend', 'Tendência positiva do score', diff >= 10 ? `O score subiu ${round(diff)} pontos no período.` : 'Não há tendência positiva relevante do score no período.', 'trend', diff >= 10 ? 'positive' : 'neutral'),
    make('chart-score-drop-trend', 'Tendência de queda do score', diff <= -10 ? `O score caiu ${round(Math.abs(diff))} pontos no período.` : 'Não há tendência de queda relevante do score no período.', 'trend', diff <= -10 ? 'warning' : 'neutral'),
    make('chart-stable-score', 'Score estável no período', Math.abs(diff) < 10 ? 'O score ficou relativamente estável no período.' : 'O score teve variação relevante no período.', 'trend', Math.abs(diff) < 10 ? 'neutral' : 'attention'),
    make('chart-high-oscillation', 'Alta oscilação dos resultados', stdev >= 15 ? 'Os resultados variaram bastante. Isso pode dificultar leitura de padrão.' : 'A variação dos resultados ficou controlada.', 'trend', stdev >= 15 ? 'attention' : 'positive'),
    make('chart-positive-peak', 'Pico positivo do período', `Maior score no período: ${Math.max(...scores)}.`, 'comparison', 'positive'),
    make('chart-lowest-point', 'Ponto mais baixo do período', `Menor score no período: ${Math.min(...scores)}.`, 'comparison', Math.min(...scores) < 40 ? 'critical' : 'attention'),
    make('chart-recovery-improving', 'Recuperação corporal em melhora', indicators.recovery.trend === 'Melhorando' ? `Recuperação atual: ${indicators.recovery.value ?? '—'}/100, em melhora.` : 'Não há melhora clara da recuperação corporal nos dados recentes.', 'recovery', indicators.recovery.trend === 'Melhorando' ? 'positive' : 'neutral'),
    make('chart-recovery-dropping', 'Recuperação corporal em queda', indicators.recovery.trend === 'Piorando' || indicators.recovery.trend === 'Queda forte' ? `Recuperação atual: ${indicators.recovery.value ?? '—'}/100, em queda.` : 'Não há queda clara da recuperação corporal nos dados recentes.', 'recovery', indicators.recovery.trend === 'Piorando' || indicators.recovery.trend === 'Queda forte' ? 'warning' : 'neutral'),
    make('chart-fatigue-increasing', 'Fadiga geral em aumento', indicators.fatigue.trend === 'Piorando' || indicators.fatigue.trend === 'Queda forte' ? `Fadiga atual: ${indicators.fatigue.value ?? '—'}/100, em aumento.` : 'Não há aumento claro da fadiga geral.', 'fatigue', indicators.fatigue.trend === 'Piorando' || indicators.fatigue.trend === 'Queda forte' ? 'warning' : 'neutral'),
    make('chart-fatigue-reducing', 'Fadiga geral em redução', indicators.fatigue.trend === 'Melhorando' ? `Fadiga atual: ${indicators.fatigue.value ?? '—'}/100, em redução.` : 'Não há redução clara da fadiga geral.', 'fatigue', indicators.fatigue.trend === 'Melhorando' ? 'positive' : 'neutral'),
    make('chart-mental-focus-drop', 'Foco mental em queda', (indicators.mentalFocus.value ?? 100) < 55 ? 'Foco mental atual entrou em zona de atenção.' : 'Foco mental não está em zona de queda relevante.', 'mental_focus', (indicators.mentalFocus.value ?? 100) < 55 ? 'attention' : 'neutral'),
    make('chart-alertness-drop', 'Estado de alerta em queda', (indicators.alertness.value ?? 100) < 55 ? 'Estado de alerta atual entrou em zona de atenção.' : 'Estado de alerta não está em queda relevante.', 'alertness', (indicators.alertness.value ?? 100) < 55 ? 'attention' : 'neutral'),
    make('chart-overload-risk-up', 'Risco de sobrecarga em aumento', (indicators.overloadRisk.value ?? 0) >= 70 ? 'O risco de sobrecarga está alto nos dados recentes.' : 'Risco de sobrecarga não está alto nos dados recentes.', 'overload_risk', (indicators.overloadRisk.value ?? 0) >= 70 ? negativeSeverity(indicators.overloadRisk.value) : 'neutral'),
    make('chart-hours-score-relation', 'Relação entre horas dormidas e score', hours.length >= 3 ? `Média de horas no período: ${round(hours.reduce((sum, value) => sum + value, 0) / hours.length, 1)}h. Compare os picos de sono com os picos de score.` : 'Ainda há poucos dados de duração para comparar horas dormidas e score.', 'sleep', 'neutral'),
    make('chart-awakenings-impact', 'Impacto dos despertares no score', awakeningsImpact >= 2 ? 'Noites com mais despertares aparecem associadas a scores baixos.' : 'Não há associação forte entre despertares e queda de score no período.', 'sleep', awakeningsImpact >= 2 ? 'attention' : 'neutral'),
    make('chart-stress-score-relation', 'Relação entre estresse e score', stressImpact >= 2 ? 'Estresse elevado aparece junto de quedas no score em registros recentes.' : 'Não há associação forte entre estresse alto e queda de score no período.', 'mental_focus', stressImpact >= 2 ? 'attention' : 'neutral'),
    make('chart-best-week-evolution', 'Semana de melhor evolução', bestWeek && bestWeek.diff > 0 ? `Maior evolução semanal: +${round(bestWeek.diff)} pontos na semana iniciada em ${bestWeek.week}.` : 'Não houve evolução semanal positiva relevante no período.', 'trend', bestWeek && bestWeek.diff >= 10 ? 'positive' : 'neutral'),
    make('chart-worst-week-drop', 'Semana de maior queda', worstWeek && worstWeek.diff < 0 ? `Maior queda semanal: ${round(worstWeek.diff)} pontos na semana iniciada em ${worstWeek.week}.` : 'Não houve queda semanal relevante no período.', 'trend', worstWeek && worstWeek.diff <= -10 ? 'warning' : 'neutral'),
  ];
  return insights;
}

function makeTeacherAlert(args: Omit<TeacherAlert, 'id' | 'description' | 'level' | 'action' | 'status' | 'createdAt' | 'date'> & { createdAt?: string }): TeacherAlert {
  const createdAt = args.createdAt ?? nowIso();
  const level = args.severity === 'critical' ? 'danger' : 'warning';
  return { ...args, id: `${args.studentId}:${args.type}`, description: args.message, level, action: args.recommendedAction, status: 'active', createdAt, date: createdAt };
}

export function buildTeacherAlertsForStudent(studentId: number | string, studentName: string, records: SleepRecordLike[], activeGoal?: SleepGoalLike | null): TeacherAlert[] {
  const sorted = sortDesc(records);
  const last = latest(sorted);
  const lastScore = scoreOrNull(last?.scoreTotal);
  const lastThree = takeLastValid(sorted, 3);
  const week = recordsLastDays(sorted, 7);
  const prevWeek = previousDays(sorted, 13, 7);
  const weekAvg = averageScore(week);
  const prevWeekAvg = averageScore(prevWeek);
  const indicators = calculateDailyIndicators(sortAsc(lastThree) as any);
  const fatigueRisk = calculateFatigueRiskOfficial(sorted);
  const avgEnergy3 = average(lastThree.map((r) => finite(r.energy) ? r.energy : null));
  const avgHoursWeek = averageHours(week);
  const goalHours = activeGoal?.hoursGoal ?? null;
  const daysWithout = daysSinceLatest(sorted);
  const scores = week.map((r) => scoreOrNull(r.scoreTotal)).filter((v): v is number => v !== null);
  const sleepRegularityStdev = standardDeviation(week.map((r) => finite(r.totalHours) ? r.totalHours : null).filter((v): v is number => v !== null));
  const alerts: TeacherAlert[] = [];
  const add = (type: string, title: string, message: string, priority: 'medium' | 'high' | 'critical', severity: 'attention' | 'warning' | 'critical', triggerReason: string, recommendedAction: string) => { if (!alerts.some((alert) => alert.type === type)) alerts.push(makeTeacherAlert({ studentId, studentName, type, title, message, priority, severity, triggerReason, recommendedAction })); };

  if (lastScore !== null && lastScore < 40) add('critical_last_night', 'Última noite em zona crítica', 'O último registro do aluno ficou abaixo de 40. Isso indica baixa recuperação imediata e exige atenção antes de qualquer treino intenso.', 'critical', 'critical', 'Último score < 40.', 'Evitar treino intenso, reduzir carga e volume, avaliar energia ao acordar, observar fadiga e estresse, considerar contato direto.');
  if (hasConsecutive(sorted, 2, (r) => (scoreOrNull(r.scoreTotal) ?? 100) < 55)) add('two_bad_nights', 'Duas noites seguidas abaixo do ideal', 'O aluno apresentou dois registros consecutivos abaixo de 55. Isso sugere queda recente de recuperação e pode indicar necessidade de ajuste no treino.', 'high', 'warning', '2 registros consecutivos com score < 55.', 'Revisar carga planejada e observar energia, fadiga e estresse antes da sessão.');
  if (week.filter((r) => (scoreOrNull(r.scoreTotal) ?? 100) < 55).length >= 3) add('three_bad_records_week', 'Três registros ruins nos últimos 7 dias', 'O aluno teve três registros abaixo do ideal nos últimos 7 dias. Mesmo que não tenham sido consecutivos, isso mostra instabilidade na recuperação semanal.', 'high', 'warning', '3 registros com score < 55 nos últimos 7 dias.', 'Evitar progressão agressiva e acompanhar os próximos registros.');
  if (weekAvg !== null && weekAvg < 55) add('low_weekly_recovery', 'Semana com recuperação abaixo do esperado', 'A média recente do aluno ficou abaixo da zona ideal. Isso indica que o problema não foi apenas uma noite isolada, mas um padrão semanal.', 'high', 'warning', 'Média dos últimos 7 dias < 55.', 'Controlar volume e intensidade até a média voltar para faixa segura.');
  if (lastThree.filter((r) => finite(r.energy) && Number(r.energy) <= 1).length >= 3 || (avgEnergy3 !== null && avgEnergy3 < 2)) add('low_morning_energy', 'Baixa energia recorrente ao acordar', 'O aluno relatou baixa energia ao acordar em registros recentes. Isso pode indicar sono pouco restaurador, fadiga acumulada ou rotina de recuperação insuficiente.', 'high', 'warning', 'Energia 0/1 em 3 registros recentes ou média < 2.', 'Conversar sobre rotina noturna, carga acumulada e recuperação fora do treino.');
  if ((indicators.fatigue.value ?? 0) >= 75) add('high_fatigue', 'Fadiga geral elevada', 'O aluno apresenta sinais de fadiga acima do ideal. Isso pode reduzir desempenho, piorar recuperação e aumentar a necessidade de controle no treino.', 'high', 'warning', 'Fadiga geral >= 75.', 'Reduzir estímulos intensos e evitar treinos até a falha.');
  if (hasPersistentHighFatigue(sorted)) add('persistent_high_fatigue', 'Fadiga elevada persistente', 'A fadiga do aluno permaneceu elevada em registros consecutivos. Isso sugere acúmulo de desgaste e pode exigir ajuste mais claro na carga de treino.', 'critical', 'critical', 'Fadiga alta em janelas recentes consecutivas ou fadiga crítica atual.', 'Reduzir carga semanal, monitorar resposta e considerar sessão regenerativa.');
  if ((indicators.readinessScore ?? 100) < 50 || ((indicators.readinessScore ?? 100) < 60 && (indicators.fatigue.value ?? 0) >= 70)) add('low_readiness', 'Baixa prontidão para o treino de hoje', 'A prontidão atual do aluno está abaixo do ideal. Ele pode não estar em boa condição para treinos intensos, progressão de carga ou estímulos complexos.', 'high', 'warning', 'Prontidão < 50 ou 50-59 com fadiga elevada.', 'Adaptar treino do dia para controle técnico, redução de volume ou recuperação.');
  if ((indicators.recovery.value ?? 100) < 40 || ((indicators.recovery.value ?? 100) < 50 && (indicators.fatigue.value ?? 0) >= 70)) add('critical_body_recovery', 'Recuperação corporal em zona crítica', 'A recuperação corporal do aluno está muito abaixo do esperado. Isso indica baixa tolerância provável à carga e maior necessidade de cuidado no treino.', 'critical', 'critical', 'Recuperação corporal < 40 ou < 50 com fadiga alta.', 'Evitar alta intensidade e priorizar recuperação ativa ou descanso.');
  if ((indicators.alertness.value ?? 100) < 40) add('critical_alertness', 'Estado de alerta em zona crítica', 'O aluno apresenta estado de alerta muito baixo. Isso pode prejudicar concentração, coordenação, tomada de decisão e segurança durante o treino.', 'high', 'warning', 'Estado de alerta em faixa crítica.', 'Evitar exercícios complexos e reforçar segurança técnica.');
  if ((indicators.mentalFocus.value ?? 100) < 40) add('critical_mental_focus', 'Foco mental em zona crítica', 'O foco mental do aluno está muito reduzido. Isso pode comprometer execução técnica, percepção de esforço e qualidade do treino.', 'high', 'warning', 'Foco mental em faixa crítica.', 'Simplificar treino e evitar tarefas de alta complexidade técnica.');
  const overload = Math.max(indicators.overloadRisk.value ?? 0, fatigueRisk ?? 0);
  if (overload >= 75) add('high_overload_risk', 'Risco elevado de sobrecarga', 'Os dados indicam maior risco de sobrecarga. O aluno pode estar acumulando baixa recuperação, fadiga elevada ou queda de prontidão.', 'critical', 'critical', 'Risco de sobrecarga alto.', 'Não progredir carga e revisar volume da sessão.');
  if (hasPersistentOverloadRisk(sorted)) add('persistent_overload_risk', 'Risco de sobrecarga persistente', 'O aluno manteve risco elevado de sobrecarga em registros recentes. Isso sugere que o problema pode estar se acumulando e precisa de intervenção mais clara.', 'critical', 'critical', 'Risco alto em janelas recentes consecutivas ou risco alto com fadiga elevada e recuperação baixa.', 'Intervir diretamente e reduzir estímulos acumulativos.');
  if (goalHours !== null && avgHoursWeek !== null && avgHoursWeek < goalHours - 1) add('severe_sleep_deficit', 'Déficit severo em relação à meta de sono', 'O aluno dormiu mais de 1 hora abaixo da meta média. Esse déficit pode prejudicar recuperação, foco, energia e resposta ao treino.', 'high', 'warning', 'Média de sono mais de 60 minutos abaixo da meta.', 'Revisar rotina e não tratar o treino como se a recuperação estivesse normal.');
  const hasAnyRecord = sorted.length > 0;
  if (hasAnyRecord && daysWithout >= 3) add('no_record_3_days', 'Sem registros há 3 dias', 'O aluno não registra dados há 3 dias. A análise perdeu confiabilidade e o professor deve retomar contato para recuperar a adesão.', 'medium', 'attention', 'Último registro há 3 dias ou mais.', 'Enviar lembrete direto e simples para retomar o hábito.');
  if (hasAnyRecord && daysWithout >= 7) add('no_record_7_days', 'Sem registros há 7 dias ou mais', 'O aluno está há pelo menos 7 dias sem registrar dados. O acompanhamento está comprometido e o professor deve retomar contato diretamente.', 'high', 'warning', 'Último registro há 7 dias ou mais.', 'Contato direto para entender barreira e retomar registro.');
  if (hasAnyRecord && week.length < 3) add('low_weekly_adherence', 'Baixa adesão nos últimos 7 dias', 'O aluno registrou menos de 3 dias na última semana. Isso reduz a precisão dos insights e dificulta o acompanhamento real da recuperação.', 'high', 'warning', 'Menos de 3 registros nos últimos 7 dias.', 'Reforçar registro diário como parte mínima do acompanhamento.');
  // Alertas existentes do backend, mantidos com os títulos oficiais decididos para não perder rastreabilidade.
  if (weekAvg !== null && weekAvg < 55) add('weekly_attention_average', 'Média semanal em zona de atenção', 'A média dos últimos 7 dias ficou abaixo de 55. Isso indica recuperação semanal abaixo da zona desejada.', 'high', 'warning', 'Média dos últimos 7 dias abaixo de 55.', 'Controlar carga semanal e acompanhar próximos registros.');
  const weeklyDropPoints = weekAvg !== null && prevWeekAvg !== null ? prevWeekAvg - weekAvg : 0;
  if (weeklyDropPoints >= 5) add('weekly_average_drop', 'Queda relevante na média semanal', `A média semanal caiu ${round(weeklyDropPoints)} ponto(s) em relação à semana anterior.`, weeklyDropPoints >= 15 ? 'critical' : weeklyDropPoints >= 10 ? 'high' : 'medium', weeklyDropPoints >= 15 ? 'critical' : weeklyDropPoints >= 10 ? 'warning' : 'attention', 'Queda de 5 pontos ou mais na média semanal.', 'Investigar piora de sono, estresse, energia e fadiga antes de manter progressão.');
  const lastThreeScores = takeLastValid(sorted, 3).map((record) => scoreOrNull(record.scoreTotal)).filter((value): value is number => value !== null);
  if (hasConsecutive(sorted, 3, (r) => (scoreOrNull(r.scoreTotal) ?? 100) < 55) || (lastThreeScores.filter((score) => score < 45).length >= 2 && lastThreeScores.some((score) => score < 55))) add('three_consecutive_low_recovery', 'Três registros seguidos em baixa recuperação', 'Há sequência de baixa recuperação suficiente para exigir ajuste no acompanhamento.', 'high', 'warning', '3 registros seguidos abaixo de 55 ou 2 abaixo de 45 + 1 abaixo de 55.', 'Reduzir estímulos intensos e acompanhar resposta nas próximas noites.');
  if (sleepRegularityStdev > 1.5 || standardDeviation(week.map((r) => finite(r.totalHours) ? Number(r.totalHours) : null).filter((value): value is number => value !== null)) > 1.5) add('high_sleep_time_irregularity', 'Alta irregularidade nos horários de sono', 'Os registros indicam alternância relevante na duração/rotina de sono.', 'medium', 'attention', 'Variação alta de duração do sono ou alternância entre noites curtas e longas.', 'Buscar horários mais consistentes de dormir e acordar.');
  if (goalHours !== null && avgHoursWeek !== null && avgHoursWeek < goalHours) add('average_sleep_deficit', 'Déficit médio de sono', `O aluno dormiu em média ${round(goalHours - avgHoursWeek, 1)}h abaixo da meta.`, goalHours - avgHoursWeek > 1 ? 'high' : 'medium', goalHours - avgHoursWeek > 1 ? 'warning' : 'attention', 'Média de sono abaixo da meta definida.', 'Ajustar rotina e evitar tratar a semana como recuperação plena.');
  if (hasAnyRecord && week.length < 5) add('low_record_consistency', 'Baixa consistência de registros', week.length === 0 ? 'Sem adesão nos últimos 7 dias.' : week.length <= 2 ? 'Baixa adesão: 1 a 2 registros nos últimos 7 dias.' : 'Adesão moderada: 3 a 4 registros nos últimos 7 dias.', week.length < 3 ? 'high' : 'medium', week.length < 3 ? 'warning' : 'attention', 'Menos de 5 registros nos últimos 7 dias.', 'Reforçar o registro como parte do acompanhamento.');
  if ((indicators.readinessScore ?? 100) < 60) add('low_training_readiness_backend', 'Prontidão baixa para treinar', 'A prontidão para treino está abaixo da faixa ideal para progressão agressiva.', 'high', 'warning', 'Prontidão abaixo de 60.', 'Ajustar intensidade, complexidade ou volume da sessão.');
  if ((indicators.recovery.value ?? 100) < 55) add('reduced_body_recovery', 'Recuperação corporal reduzida', 'A recuperação corporal está abaixo do ideal para suportar alta carga com segurança.', (indicators.recovery.value ?? 100) < 40 ? 'critical' : 'high', (indicators.recovery.value ?? 100) < 40 ? 'critical' : 'warning', 'Recuperação corporal abaixo de 55.', 'Evitar alta intensidade e priorizar recuperação.');
  if ((indicators.alertness.value ?? 100) < 55) add('low_alertness_backend', 'Baixo estado de alerta', 'O estado de alerta está reduzido e pode afetar segurança, concentração e tomada de decisão.', 'high', 'warning', 'Estado de alerta abaixo de 55.', 'Evitar tarefas complexas e observar segurança técnica.');
  if ((indicators.mentalFocus.value ?? 100) < 55) add('reduced_mental_focus_backend', 'Foco mental reduzido', 'O foco mental está reduzido e pode comprometer execução técnica e percepção de esforço.', 'medium', 'attention', 'Foco mental abaixo de 55.', 'Simplificar a sessão e evitar exigências técnicas excessivas.');
  if (fatigueRisk !== null && fatigueRisk >= 75) add('accumulated_fatigue_risk', 'Risco elevado de fadiga acumulada', 'O risco oficial de fadiga acumulada está elevado, combinando média dos últimos scores, tendência recente e energia ao acordar.', fatigueRisk >= 85 ? 'critical' : 'high', fatigueRisk >= 85 ? 'critical' : 'warning', 'Risco oficial de fadiga acumulada >= 75.', 'Reduzir carga, evitar falha e monitorar recuperação nas próximas 24-48 horas.');
  const weekDrop = weekAvg !== null && prevWeekAvg !== null ? prevWeekAvg - weekAvg : 0;
  const consecutiveDrop = sortAsc(takeLastValid(sorted, 2));
  const dayDrop = consecutiveDrop.length === 2 ? (scoreOrNull(consecutiveDrop[0].scoreTotal) ?? 0) - (scoreOrNull(consecutiveDrop[1].scoreTotal) ?? 0) : 0;
  if (weekDrop >= 15 || dayDrop >= 20) add('sudden_score_drop', 'Queda brusca no score recente', 'O score do aluno caiu de forma relevante em relação ao padrão recente. Isso pode indicar piora rápida na recuperação, sono, estresse ou fadiga.', 'high', 'warning', 'Queda de 15 pontos na média ou 20 pontos entre registros.', 'Investigar fator agudo antes de manter progressão de treino.');
  if (standardDeviation(scores) >= 15 || sleepRegularityStdev >= 1.5) add('unstable_sleep_recovery_pattern', 'Padrão instável de sono e recuperação', 'Os registros do aluno apresentam grande variação de sono, score ou recuperação. Essa instabilidade pode dificultar a prescrição e exigir acompanhamento mais próximo.', 'medium', 'attention', 'Alta variação de score, horas ou rotina.', 'Buscar regularidade antes de interpretar respostas finas do treino.');
  const negativeFactors = [lastScore !== null && lastScore < 40, hasAnyRecord && week.length < 3, goalHours !== null && avgHoursWeek !== null && avgHoursWeek < goalHours - 1, overload >= 75, (indicators.fatigue.value ?? 0) >= 75, (indicators.readinessScore ?? 100) < 50, weekDrop >= 10].filter(Boolean).length;
  if (negativeFactors >= 2) add('teacher_contact_recommended', 'Contato recomendado pelo professor', 'O aluno apresenta combinação de fatores que justifica contato direto: baixa recuperação, baixa adesão, score crítico, fadiga elevada ou risco de sobrecarga.', 'critical', 'critical', 'Dois ou mais fatores negativos ativos.', 'Entrar em contato e definir uma ação prática para as próximas 24-48 horas.');
  return alerts.sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.priority] - { critical: 0, high: 1, medium: 2 }[b.priority]));
}

export function buildTeacherStudentProfile(studentId: number | string, studentName: string, records: SleepRecordLike[], activeGoal?: SleepGoalLike | null): StudentProfileInsights {
  const all = sortDesc(records);
  const week = recordsLastDays(all, 7);
  const month = recordsLastDays(all, 30);
  const previousWeek = previousDays(all, 13, 7);
  const indicators = calculateDailyIndicators(sortAsc(takeLastValid(all, 3)) as any);
  const alerts = buildTeacherAlertsForStudent(studentId, studentName, all, activeGoal);
  const weeklyAvg = averageScore(week);
  const monthlyAvg = averageScore(month);
  const bestWeek = week.length ? Math.max(...week.map((r) => scoreOrNull(r.scoreTotal) ?? 0)) : null;
  const worstWeek = week.length ? Math.min(...week.map((r) => scoreOrNull(r.scoreTotal) ?? 100)) : null;
  const adherence = week.length;
  const sleepAvg = averageHours(week);
  const blocks: StudentProfileInsights['blocks'] = [
    { id: 'summary-7-days', title: 'Resumo dos últimos 7 dias', value: weeklyAvg !== null ? round(weeklyAvg) : null, message: `${week.length} registro(s), melhor ${bestWeek ?? '—'}, pior ${worstWeek ?? '—'}, sono médio ${sleepAvg !== null ? `${round(sleepAvg, 1)}h` : '—'}.`, severity: positiveSeverity(weeklyAvg) },
    { id: 'summary-30-days', title: 'Resumo dos últimos 30 dias', value: monthlyAvg !== null ? round(monthlyAvg) : null, message: `${month.length} registro(s) no mês. Tendência geral: ${trendDiff(month) >= 10 ? 'melhora' : trendDiff(month) <= -10 ? 'queda' : 'estável'}.`, severity: positiveSeverity(monthlyAvg) },
    { id: 'week-comparison', title: 'Comparação com a semana anterior', value: weeklyAvg !== null && averageScore(previousWeek) !== null ? round(weeklyAvg - (averageScore(previousWeek) as number)) : null, message: previousWeek.length ? 'Comparação calculada com base nos 7 dias anteriores.' : DATA_MESSAGES.lessThanThree, severity: weeklyAvg !== null && averageScore(previousWeek) !== null && weeklyAvg < (averageScore(previousWeek) as number) - 5 ? 'attention' : 'neutral' },
    { id: 'recovery-trend', title: 'Tendência de recuperação corporal', value: indicators.recovery.value, message: `Recuperação corporal atual em ${indicators.recovery.value ?? '—'}/100.`, severity: positiveSeverity(indicators.recovery.value) },
    { id: 'fatigue-trend', title: 'Tendência de fadiga geral', value: indicators.fatigue.value, message: `Fadiga geral atual em ${indicators.fatigue.value ?? '—'}/100.`, severity: negativeSeverity(indicators.fatigue.value) },
    { id: 'readiness-trend', title: 'Tendência de prontidão para treino', value: indicators.readinessScore, message: `Prontidão atual em ${indicators.readinessScore ?? '—'}/100.`, severity: positiveSeverity(indicators.readinessScore) },
    { id: 'current-risk', title: 'Risco atual do aluno', value: alerts[0]?.priority ?? 'baixo', message: alerts[0]?.message ?? 'Sem alerta prioritário ativo com os dados atuais.', severity: alerts[0]?.severity === 'critical' ? 'critical' : alerts[0]?.severity === 'warning' ? 'warning' : 'positive' },
    { id: 'recent-adherence', title: 'Adesão recente aos registros', value: `${adherence}/7`, message: adherence >= 5 ? 'Alta adesão.' : adherence >= 3 ? 'Adesão moderada.' : adherence >= 1 ? 'Baixa adesão.' : 'Sem adesão.', severity: adherence >= 5 ? 'positive' : adherence >= 3 ? 'attention' : 'warning' },
    { id: 'strengths', title: 'Pontos fortes do aluno', message: weeklyAvg !== null && weeklyAvg >= 70 ? 'Boa recuperação recente, adesão útil para análise e resposta favorável.' : 'Ainda sem ponto forte consolidado. A prioridade é gerar base confiável.', severity: weeklyAvg !== null && weeklyAvg >= 70 ? 'positive' : 'neutral' },
    { id: 'attention-points', title: 'Pontos de atenção do aluno', message: alerts.length ? alerts.slice(0, 3).map((a) => a.title).join(' • ') : 'Nenhum alerta relevante ativo.', severity: alerts.length ? 'attention' : 'positive' },
    { id: 'best-pattern', title: 'Melhor padrão recente', message: 'Avalie os dias com melhor score, menor estresse, menos despertares e maior energia ao acordar.', severity: 'neutral' },
    { id: 'worst-pattern', title: 'Pior padrão recente', message: 'Avalie noites com score baixo, sono curto, despertares altos, estresse elevado e baixa energia.', severity: alerts.length ? 'attention' : 'neutral' },
    { id: 'training-adjustment', title: 'Recomendação de ajuste de treino', message: indicators.readinessScore === null ? DATA_MESSAGES.lessThanThree : indicators.readinessScore >= 70 && (indicators.fatigue.value ?? 0) < 70 ? 'Manter treino planejado.' : indicators.readinessScore >= 55 ? 'Controlar intensidade e evitar progressões agressivas.' : indicators.readinessScore >= 40 ? 'Reduzir volume e evitar falha muscular.' : 'Priorizar recuperação ativa ou descanso.', severity: positiveSeverity(indicators.readinessScore) },
    { id: 'contact-recommendation', title: 'Recomendação de contato com o aluno', message: alerts.some((a) => a.type === 'teacher_contact_recommended') ? 'Contato prioritário.' : alerts.length ? 'Contato preventivo/recomendado.' : 'Sem necessidade imediata.', severity: alerts.some((a) => a.type === 'teacher_contact_recommended') ? 'critical' : alerts.length ? 'attention' : 'positive' },
    { id: 'recent-alert-history', title: 'Histórico de alertas recentes', message: alerts.length ? alerts.map((a) => `${a.title}: ${a.priority}`).join(' | ') : 'Sem alertas recentes ativos.', severity: alerts.length ? 'attention' : 'positive' },
    { id: 'post-guidance-response', title: 'Resposta após orientação anterior', message: 'Use este bloco para comparar antes/depois de uma orientação registrada pelo professor. Sem orientação registrada, não há conclusão automática.', severity: 'neutral' },
  ];
  return { insufficientDataMessage: getInsufficientDataMessage(all, 'week') ?? undefined, blocks, sections: { history: buildHistoryInsights(all), charts: buildChartInsights(all), studentInsights: buildStudentInsightDashboard(all, activeGoal).insights }, alerts };
}
