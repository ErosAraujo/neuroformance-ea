/**
 * Indicadores de sono aplicados ao treino.
 * Últimas 3 noites devem entrar em ordem cronológica (mais antiga -> mais recente).
 * Campo ausente é reponderado, nunca tratado como nota ruim.
 */
export type Trend = 'Melhorando' | 'Estável' | 'Piorando' | 'Queda forte';
export type PositiveClassification = 'Excelente' | 'Boa' | 'Moderada' | 'Baixa' | 'Crítica';
export type NegativeClassification = 'Controlada' | 'Baixa' | 'Moderada' | 'Alta' | 'Crítica';
export type IndicatorClassification = PositiveClassification | NegativeClassification;

export interface SleepRecordForIndicators {
  scoreTotal: number;
  perceivedQuality: number;
  morningState?: number | null;
  energy?: number | null;
  stress?: number | null;
  mood?: number | null;
  generalPain?: number | null;
  bodyHeaviness?: number | null;
}

export interface IndicatorResult {
  value: number | null;
  classification: IndicatorClassification | null;
  trend?: Trend | null;
  confidence: number;
  base: 'completa' | 'reduzida' | 'inicial' | 'sem_dados';
  missingFields: string[];
}

export interface DailyIndicatorsResult {
  hasData: boolean;
  baseReduced: boolean;
  recordsUsed: number;
  readinessScore: number | null;
  readinessClassification: PositiveClassification | null;
  alertness: IndicatorResult;
  fatigue: IndicatorResult;
  mentalFocus: IndicatorResult;
  recovery: IndicatorResult;
  overloadRisk: IndicatorResult;
  generalStatus: string;
  generalStatusScore: number | null;
  generalStatusClassification: PositiveClassification | null;
  trend: Trend | null;
}

type WeightedComponent = { value: number | null; weight: number; field: string };
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundScore = (value: number) => Math.round(clamp(value));

export function classifyPositive(value: number | null): PositiveClassification | null {
  if (value === null) return null;
  if (value >= 85) return 'Excelente';
  if (value >= 70) return 'Boa';
  if (value >= 55) return 'Moderada';
  if (value >= 40) return 'Baixa';
  return 'Crítica';
}
export function classifyNegative(value: number | null): NegativeClassification | null {
  if (value === null) return null;
  if (value >= 85) return 'Crítica';
  if (value >= 70) return 'Alta';
  if (value >= 55) return 'Moderada';
  if (value >= 40) return 'Baixa';
  return 'Controlada';
}
function convertScale(value: number | null | undefined, allowZero = false): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const min = allowZero ? 0 : 1;
  if (n < min || n > 5) return null;
  return roundScore(n * 20);
}
function invert(value: number | null): number | null { return typeof value === 'number' ? roundScore(100 - value) : null; }
function baseFromRecords(recordsUsed: number): IndicatorResult['base'] { return recordsUsed >= 3 ? 'completa' : recordsUsed === 2 ? 'reduzida' : recordsUsed === 1 ? 'inicial' : 'sem_dados'; }
function confidenceFrom(recordsUsed: number, missingFields: string[]) { if (recordsUsed <= 0) return 0; const base = recordsUsed >= 3 ? 100 : recordsUsed === 2 ? 70 : 40; return Math.max(10, base - Math.min(35, missingFields.length * 7)); }
function weightedAverage(components: WeightedComponent[]) {
  const valid = components.filter((c) => typeof c.value === 'number') as Array<{ value: number; weight: number; field: string }>;
  const missingFields = components.filter((c) => c.value === null).map((c) => c.field);
  const weightTotal = valid.reduce((sum, c) => sum + c.weight, 0);
  if (!valid.length || weightTotal <= 0) return { value: null as number | null, missingFields };
  return { value: roundScore(valid.reduce((sum, c) => sum + c.value * c.weight, 0) / weightTotal), missingFields };
}
function average(values: Array<number | null | undefined>): number | null { const valid = values.map(Number).filter((v) => Number.isFinite(v)); return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null; }
function normalizeLastThree(records: SleepRecordForIndicators[]) { return records.slice(-3); }
function lastRecord(records: SleepRecordForIndicators[]) { return records[records.length - 1]; }

export function calculateTrend(input: SleepRecordForIndicators[]): Trend | null {
  const records = normalizeLastThree(input);
  if (records.length < 3) return null;
  const scores = records.map((r) => Number(r.scoreTotal)).filter(Number.isFinite);
  if (scores.length < 3) return null;
  const diff = scores[2] - scores[0];
  if (diff >= 10) return 'Melhorando';
  if (diff <= -10) return 'Queda forte';
  if (Math.abs(diff) <= 5) return 'Estável';
  return diff < 0 ? 'Piorando' : 'Melhorando';
}
function convertTrendPositive(t: Trend | null): number | null { if (!t) return null; return t === 'Melhorando' ? 100 : t === 'Estável' ? 70 : t === 'Piorando' ? 40 : 20; }
function convertTrendNegative(t: Trend | null): number | null { if (!t) return null; return t === 'Melhorando' ? 20 : t === 'Estável' ? 50 : t === 'Piorando' ? 75 : 100; }
function buildResult(value: number | null, classification: IndicatorClassification | null, recordsUsed: number, missingFields: string[], trend: Trend | null): IndicatorResult { return { value, classification, trend, confidence: confidenceFrom(recordsUsed, missingFields), base: baseFromRecords(recordsUsed), missingFields }; }

export function calculateReadiness(input: SleepRecordForIndicators[]) {
  const records = normalizeLastThree(input);
  if (!records.length) return { value: null as number | null, classification: null as PositiveClassification | null };
  const last = lastRecord(records);
  const trend = calculateTrend(records);
  const { value } = weightedAverage([
    { value: average(records.map((r) => r.scoreTotal)), weight: 0.55, field: 'score de sono recente' },
    { value: convertScale(last?.energy ?? null), weight: 0.20, field: 'energia ao acordar' },
    { value: convertScale(last?.morningState ?? null), weight: 0.15, field: 'estado ao acordar' },
    { value: convertTrendPositive(trend), weight: 0.10, field: 'tendência das últimas noites' },
  ]);
  return { value, classification: classifyPositive(value) };
}

export function calculateAlertnessIndicator(input: SleepRecordForIndicators[]): IndicatorResult {
  const records = normalizeLastThree(input), trend = calculateTrend(records); if (!records.length) return buildResult(null, null, 0, [], trend);
  const last = lastRecord(records); const avgQuality = convertScale(average(records.map((r) => r.perceivedQuality)), false);
  const { value, missingFields } = weightedAverage([
    { value: convertScale(last?.energy ?? null), weight: 0.30, field: 'energia ao acordar' },
    { value: convertScale(last?.morningState ?? null), weight: 0.25, field: 'estado ao acordar' },
    { value: average(records.map((r) => r.scoreTotal)), weight: 0.25, field: 'média dos scores' },
    { value: avgQuality, weight: 0.10, field: 'qualidade média' },
    { value: convertTrendPositive(trend), weight: 0.10, field: 'tendência' },
  ]);
  return buildResult(value, classifyPositive(value), records.length, missingFields, trend);
}
export function calculateFatigueIndicator(input: SleepRecordForIndicators[]): IndicatorResult {
  const records = normalizeLastThree(input), trend = calculateTrend(records); if (!records.length) return buildResult(null, null, 0, [], trend);
  const last = lastRecord(records); const { value, missingFields } = weightedAverage([
    { value: invert(average(records.map((r) => r.scoreTotal))), weight: 0.30, field: 'score invertido' },
    { value: invert(convertScale(last?.energy ?? null)), weight: 0.25, field: 'energia invertida' },
    { value: invert(convertScale(last?.morningState ?? null)), weight: 0.20, field: 'estado invertido' },
    { value: convertScale(last?.stress ?? null), weight: 0.15, field: 'estresse' },
    { value: convertTrendNegative(trend), weight: 0.10, field: 'tendência negativa' },
  ]);
  return buildResult(value, classifyNegative(value), records.length, missingFields, trend);
}
export function calculateMentalFocusIndicator(input: SleepRecordForIndicators[], alertness: IndicatorResult): IndicatorResult {
  const records = normalizeLastThree(input), trend = alertness.trend ?? calculateTrend(records); if (!records.length) return buildResult(null, null, 0, [], trend);
  const last = lastRecord(records); const { value, missingFields } = weightedAverage([
    { value: average(records.map((r) => r.scoreTotal)), weight: 0.25, field: 'média dos scores' },
    { value: alertness.value, weight: 0.25, field: 'estado de alerta' },
    { value: convertScale(last?.mood ?? null), weight: 0.20, field: 'humor' },
    { value: invert(convertScale(last?.stress ?? null)), weight: 0.15, field: 'estresse invertido' },
    { value: convertTrendPositive(trend), weight: 0.15, field: 'tendência' },
  ]);
  return buildResult(value, classifyPositive(value), records.length, missingFields, trend);
}
export function calculateRecoveryIndicator(input: SleepRecordForIndicators[], fatigue: IndicatorResult): IndicatorResult {
  const records = normalizeLastThree(input), trend = fatigue.trend ?? calculateTrend(records); if (!records.length) return buildResult(null, null, 0, [], trend);
  const last = lastRecord(records); const { value, missingFields } = weightedAverage([
    { value: average(records.map((r) => r.scoreTotal)), weight: 0.35, field: 'média dos scores' },
    { value: convertScale(last?.energy ?? null), weight: 0.20, field: 'energia' },
    { value: convertScale(last?.morningState ?? null), weight: 0.20, field: 'estado ao acordar' },
    { value: invert(fatigue.value), weight: 0.15, field: 'fadiga invertida' },
    { value: invert(convertScale(last?.bodyHeaviness ?? null)), weight: 0.10, field: 'corpo pesado' },
  ]);
  return buildResult(value, classifyPositive(value), records.length, missingFields, trend);
}
export function calculateOverloadRiskIndicator(input: SleepRecordForIndicators[], fatigue: IndicatorResult, recovery: IndicatorResult, readiness: number | null): IndicatorResult {
  const records = normalizeLastThree(input), trend = calculateTrend(records); if (!records.length) return buildResult(null, null, 0, [], trend);
  const last = lastRecord(records); const { value, missingFields } = weightedAverage([
    { value: fatigue.value, weight: 0.30, field: 'fadiga' },
    { value: invert(recovery.value), weight: 0.25, field: 'recuperação invertida' },
    { value: invert(readiness), weight: 0.20, field: 'prontidão invertida' },
    { value: convertScale(last?.generalPain ?? null), weight: 0.15, field: 'dor muscular geral' },
    { value: convertTrendNegative(trend), weight: 0.10, field: 'tendência negativa' },
  ]);
  return buildResult(value, classifyNegative(value), records.length, missingFields, trend);
}

export function calculateGeneralStatusScore(indicators: Pick<DailyIndicatorsResult, 'readinessScore' | 'recovery' | 'fatigue' | 'alertness' | 'mentalFocus' | 'overloadRisk'>): number | null {
  const values = [
    indicators.readinessScore,
    indicators.recovery.value,
    indicators.alertness.value,
    indicators.mentalFocus.value,
    invert(indicators.fatigue.value),
    invert(indicators.overloadRisk.value),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!values.length) return null;
  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function getGeneralStatus(readiness: number | null, fatigue: IndicatorResult, overload: IndicatorResult) {
  if (readiness === null) return 'Sem dados suficientes para orientar o treino.';
  const f = fatigue.value ?? 0, o = overload.value ?? 0;
  if (readiness < 40 || f >= 85 || o >= 85) return 'Treino intenso não recomendado hoje.';
  if (readiness < 55 || f >= 70 || o >= 70) return 'Reduzir intensidade, evitar falha e priorizar recuperação.';
  if (readiness < 70 || f >= 55 || o >= 55) return 'Treinar com controle de carga, volume e atenção à técnica.';
  return 'Treino liberado com controle normal.';
}
export function calculateDailyIndicators(input: SleepRecordForIndicators[]): DailyIndicatorsResult {
  const records = normalizeLastThree(input); const trend = calculateTrend(records); const readiness = calculateReadiness(records);
  const alertness = calculateAlertnessIndicator(records); const fatigue = calculateFatigueIndicator(records); const mentalFocus = calculateMentalFocusIndicator(records, alertness); const recovery = calculateRecoveryIndicator(records, fatigue); const overloadRisk = calculateOverloadRiskIndicator(records, fatigue, recovery, readiness.value);
  const generalStatusScore = calculateGeneralStatusScore({ readinessScore: readiness.value, recovery, fatigue, alertness, mentalFocus, overloadRisk });
  return { hasData: records.length > 0, baseReduced: records.length > 0 && records.length < 3, recordsUsed: records.length, readinessScore: readiness.value, readinessClassification: readiness.classification, alertness, fatigue, mentalFocus, recovery, overloadRisk, generalStatus: getGeneralStatus(readiness.value, fatigue, overloadRisk), generalStatusScore, generalStatusClassification: classifyPositive(generalStatusScore), trend };
}
