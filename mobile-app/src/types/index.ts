// Tipos e interfaces compartilhados entre telas e serviços

export interface SleepRecord {
  id: number;
  studentId: number;
  date: string; // ISO-8601
  sleepTime: string; // ISO-8601 DateTime vindo do backend
  wakeTime: string;  // ISO-8601 DateTime vindo do backend
  totalHours: number;
  perceivedQuality: number; // 1–5
  awakenings: number;
  morningState: number; // 1–5
  energy: number; // 0–5
  timeToSleep?: number;
  nap?: boolean;
  caffeine?: boolean;
  alcohol?: boolean;
  screenBeforeSleep?: boolean;
  stress?: number;
  pain?: boolean;
  generalPain?: number;
  bodyHeaviness?: number;
  mood?: number;
  notes?: string;
  scoreDuration: number;
  scoreQuality: number;
  scoreContinuity: number;
  scoreState: number;
  scoreRegularity: number;
  scoreTotal: number;
  classification: 'Excelente' | 'Bom' | 'Regular' | 'Ruim' | 'Crítico';
  createdAt: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
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
  trend: 'melhorando' | 'estável' | 'piorando' | 'Melhorando' | 'Estável' | 'Piorando' | string;
}

export interface RecoverySummary {
  hasData: boolean;
  recoveryLevel: 'Excelente' | 'Alto' | 'Médio' | 'Baixo' | 'Crítico' | null;
  readinessScore: number | null;
  fatigueRisk: 'Muito Baixo' | 'Baixo' | 'Moderado' | 'Alto' | 'Elevado' | null;
  recoveryScore: number | null;
  weeklyTrendPercent: number | null;
  trainingSuggestion: string;
}

export interface IndicatorResult {
  value: number | null;
  classification: string | null;
  trend?: string | null;
  confidence: number;
  base: 'completa' | 'reduzida' | 'inicial' | 'sem_dados' | string;
  missingFields: string[];
}

export interface DailyIndicators {
  hasData: boolean;
  baseReduced: boolean;
  recordsUsed: number;
  readinessScore: number | null;
  readinessClassification: string | null;
  alertness: IndicatorResult;
  fatigue: IndicatorResult;
  mentalFocus: IndicatorResult;
  recovery: IndicatorResult;
  overloadRisk: IndicatorResult;
  generalStatus: string;
  generalStatusScore?: number | null;
  generalStatusClassification?: string | null;
  trend: string | null;
  message?: string;
}

export interface SleepGoal {
  id: number;
  studentId: number;
  hoursGoal: number;
  sleepTimeGoal: string;
  wakeTimeGoal: string;
  regularityGoal: number;
  active: boolean;
}

export interface Alert {
  id: number;
  studentId: number;
  type: string;
  description: string;
  level: 'info' | 'warning' | 'danger';
  date: string;
  resolved: boolean;
}

export interface Observation {
  id: number;
  studentId: number;
  teacherId: number;
  date: string;
  text: string;
}

export type InsightSeverity = 'positive' | 'neutral' | 'attention' | 'warning' | 'critical';

export interface Insight {
  id: string;
  title: string;
  message?: string;
  description?: string;
  category?: string;
  audience?: 'student' | 'teacher' | 'both' | string;
  screen?: string;
  severity?: InsightSeverity | string;
  priority?: 'low' | 'medium' | 'high' | 'critical' | string;
  source?: string;
  triggerReason?: string;
  recommendedAction?: string;
  createdAt?: string;
}

export interface StudentInsightsPayload {
  insufficientDataMessage?: string | null;
  insights?: Insight[];
  blocks?: Array<{ id: string; title: string; value?: string | number; message?: string; severity?: string; priority?: string }>;
}
