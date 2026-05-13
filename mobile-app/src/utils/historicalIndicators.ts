import { SleepRecord } from '../types';

export type HistoricalIndicatorPoint = {
  date: string;
  scoreTotal: number | null;
  statusGeneral: number | null;
  readiness: number | null;
  recovery: number | null;
  fatigue: number | null;
  alertness: number | null;
  mentalFocus: number | null;
  overloadRisk: number | null;
  totalHours: number | null;
  perceivedQuality: number | null;
  morningState: number | null;
  energy: number | null;
  awakenings: number | null;
  stress: number | null;
  mood: number | null;
  generalPain: number | null;
  bodyHeaviness: number | null;
  nap: number | null;
  caffeine: number | null;
  alcohol: number | null;
  screenBeforeSleep: number | null;
  pain: number | null;
  regularity: number | null;
};

export type WeeklyStatusPoint = {
  date: string;
  value: number | null;
};

type Trend = 'Melhorando' | 'Estável' | 'Piorando' | 'Queda forte';
type Component = { value: number | null; weight: number };

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundScore = (value: number) => Math.round(clamp(value));
const roundOne = (value: number) => Math.round(value * 10) / 10;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const invert = (value: number | null) => finite(value) ? roundScore(100 - value) : null;
const boolToNumber = (value: unknown) => typeof value === 'boolean' ? (value ? 1 : 0) : null;

const average = (values: Array<number | null | undefined>) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const weightedAverage = (components: Component[]) => {
  const valid = components.filter((component): component is { value: number; weight: number } => finite(component.value));
  const weightTotal = valid.reduce((sum, component) => sum + component.weight, 0);
  if (!valid.length || weightTotal <= 0) return null;
  return roundScore(valid.reduce((sum, component) => sum + component.value * component.weight, 0) / weightTotal);
};

const convertScale = (value: number | null | undefined, allowZero = false) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const min = allowZero ? 0 : 1;
  if (parsed < min || parsed > 5) return null;
  return roundScore(parsed * 20);
};

const calculateTrend = (records: SleepRecord[]): Trend | null => {
  const lastThree = records.slice(-3);
  if (lastThree.length < 3) return null;
  const scores = lastThree.map((record) => numberOrNull(record.scoreTotal)).filter((score): score is number => score !== null);
  if (scores.length < 3) return null;
  const diff = scores[2] - scores[0];
  if (diff >= 10) return 'Melhorando';
  if (diff <= -10) return 'Queda forte';
  if (Math.abs(diff) <= 5) return 'Estável';
  return diff < 0 ? 'Piorando' : 'Melhorando';
};

const trendPositive = (trend: Trend | null) => {
  if (!trend) return null;
  if (trend === 'Melhorando') return 100;
  if (trend === 'Estável') return 70;
  if (trend === 'Piorando') return 40;
  return 20;
};

const trendNegative = (trend: Trend | null) => {
  if (!trend) return null;
  if (trend === 'Melhorando') return 20;
  if (trend === 'Estável') return 50;
  if (trend === 'Piorando') return 75;
  return 100;
};

const latest = (records: SleepRecord[]) => records[records.length - 1];

export function statusGeneralFrom(values: Pick<HistoricalIndicatorPoint, 'readiness' | 'recovery' | 'fatigue' | 'alertness' | 'mentalFocus' | 'overloadRisk'>) {
  const components = [
    values.readiness,
    values.recovery,
    values.alertness,
    values.mentalFocus,
    finite(values.fatigue) ? 100 - values.fatigue : null,
    finite(values.overloadRisk) ? 100 - values.overloadRisk : null,
  ].filter((value): value is number => finite(value));
  if (!components.length) return null;
  return roundOne(components.reduce((sum, value) => sum + value, 0) / components.length);
}

function calculatePoint(windowRecords: SleepRecord[]): HistoricalIndicatorPoint {
  const records = windowRecords.slice(-3);
  const last = latest(records);
  const trend = calculateTrend(records);
  const avgScore = average(records.map((record) => numberOrNull(record.scoreTotal)));
  const avgQuality = convertScale(average(records.map((record) => numberOrNull(record.perceivedQuality))), false);

  const readiness = weightedAverage([
    { value: avgScore, weight: 0.55 },
    { value: convertScale(numberOrNull(last?.energy), true), weight: 0.20 },
    { value: convertScale(numberOrNull(last?.morningState)), weight: 0.15 },
    { value: trendPositive(trend), weight: 0.10 },
  ]);

  const alertness = weightedAverage([
    { value: convertScale(numberOrNull(last?.energy), true), weight: 0.30 },
    { value: convertScale(numberOrNull(last?.morningState)), weight: 0.25 },
    { value: avgScore, weight: 0.25 },
    { value: avgQuality, weight: 0.10 },
    { value: trendPositive(trend), weight: 0.10 },
  ]);

  const fatigue = weightedAverage([
    { value: invert(avgScore), weight: 0.30 },
    { value: invert(convertScale(numberOrNull(last?.energy), true)), weight: 0.25 },
    { value: invert(convertScale(numberOrNull(last?.morningState))), weight: 0.20 },
    { value: convertScale(numberOrNull(last?.stress)), weight: 0.15 },
    { value: trendNegative(trend), weight: 0.10 },
  ]);

  const mentalFocus = weightedAverage([
    { value: avgScore, weight: 0.25 },
    { value: alertness, weight: 0.25 },
    { value: convertScale(numberOrNull(last?.mood)), weight: 0.20 },
    { value: invert(convertScale(numberOrNull(last?.stress))), weight: 0.15 },
    { value: trendPositive(trend), weight: 0.15 },
  ]);

  const recovery = weightedAverage([
    { value: avgScore, weight: 0.35 },
    { value: convertScale(numberOrNull(last?.energy), true), weight: 0.20 },
    { value: convertScale(numberOrNull(last?.morningState)), weight: 0.20 },
    { value: invert(fatigue), weight: 0.15 },
    { value: invert(convertScale(numberOrNull(last?.bodyHeaviness))), weight: 0.10 },
  ]);

  const overloadRisk = weightedAverage([
    { value: fatigue, weight: 0.30 },
    { value: invert(recovery), weight: 0.25 },
    { value: invert(readiness), weight: 0.20 },
    { value: convertScale(numberOrNull(last?.generalPain)), weight: 0.15 },
    { value: trendNegative(trend), weight: 0.10 },
  ]);

  const base = {
    date: String(last?.date || '').slice(0, 10),
    scoreTotal: numberOrNull(last?.scoreTotal),
    readiness,
    recovery,
    fatigue,
    alertness,
    mentalFocus,
    overloadRisk,
    totalHours: numberOrNull(last?.totalHours),
    perceivedQuality: numberOrNull(last?.perceivedQuality),
    morningState: numberOrNull(last?.morningState),
    energy: numberOrNull(last?.energy),
    awakenings: numberOrNull(last?.awakenings),
    stress: numberOrNull(last?.stress),
    mood: numberOrNull(last?.mood),
    generalPain: numberOrNull(last?.generalPain),
    bodyHeaviness: numberOrNull(last?.bodyHeaviness),
    nap: boolToNumber(last?.nap),
    caffeine: boolToNumber(last?.caffeine),
    alcohol: boolToNumber(last?.alcohol),
    screenBeforeSleep: boolToNumber(last?.screenBeforeSleep),
    pain: boolToNumber(last?.pain),
    regularity: numberOrNull(last?.scoreRegularity),
  };

  return { ...base, statusGeneral: statusGeneralFrom(base) };
}

export function buildHistoricalIndicatorPoints(records: SleepRecord[]) {
  const ordered = [...records]
    .filter((record) => record?.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return ordered.map((_, index) => calculatePoint(ordered.slice(0, index + 1)));
}

export function buildWeeklyStatusPoints(records: SleepRecord[], currentStatusScore?: number | null): WeeklyStatusPoint[] {
  const points = buildHistoricalIndicatorPoints(records)
    .map((point) => ({ date: point.date, value: point.statusGeneral }))
    .filter((point) => point.date)
    .slice(-7);

  if (points.length && finite(currentStatusScore)) {
    points[points.length - 1] = { ...points[points.length - 1], value: roundOne(currentStatusScore) };
  }

  return points;
}
