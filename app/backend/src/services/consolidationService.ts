import { SleepRecordLike } from '../types/sleepRecord';

export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  averageHours: number;
  averageQuality: number;
  averageEnergy: number;
  nightsRecorded: number;
  goodNights: number;
  badNights: number;
  regularityAverage: number;
  adherence: number;
  trend: 'melhorando' | 'estável' | 'piorando';
}

export function consolidateWeek(records: SleepRecordLike[], previousWeekAverage?: number): WeeklySummary {
  const ordered = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const nights = ordered.length;
  const averageScore = nights ? ordered.reduce((sum, r) => sum + r.scoreTotal, 0) / nights : 0;
  const trend: 'melhorando' | 'estável' | 'piorando' = previousWeekAverage === undefined
    ? 'estável'
    : averageScore > previousWeekAverage + 5
      ? 'melhorando'
      : averageScore < previousWeekAverage - 5
        ? 'piorando'
        : 'estável';

  return {
    weekStart: ordered[0]?.date ?? new Date(),
    weekEnd: ordered[ordered.length - 1]?.date ?? new Date(),
    averageScore,
    bestScore: nights ? Math.max(...ordered.map((r) => r.scoreTotal)) : 0,
    worstScore: nights ? Math.min(...ordered.map((r) => r.scoreTotal)) : 0,
    averageHours: nights ? ordered.reduce((sum, r) => sum + r.totalHours, 0) / nights : 0,
    averageQuality: nights ? ordered.reduce((sum, r) => sum + r.perceivedQuality, 0) / nights : 0,
    averageEnergy: nights ? ordered.reduce((sum, r) => sum + r.energy, 0) / nights : 0,
    nightsRecorded: nights,
    goodNights: ordered.filter((r) => r.scoreTotal >= 70).length,
    badNights: ordered.filter((r) => r.scoreTotal < 55).length,
    regularityAverage: nights ? ordered.reduce((sum, r) => sum + r.scoreRegularity, 0) / nights : 0,
    adherence: (nights / 7) * 100,
    trend,
  };
}
