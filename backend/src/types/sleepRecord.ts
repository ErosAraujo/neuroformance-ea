export interface SleepRecordLike {
  id?: number;
  studentId: number;
  date: Date;
  sleepTime?: Date;
  wakeTime?: Date;
  totalHours: number;
  perceivedQuality: number;
  awakenings: number;
  morningState?: number;
  energy: number;
  stress?: number | null;
  mood?: number | null;
  generalPain?: number | null;
  bodyHeaviness?: number | null;
  scoreDuration?: number;
  scoreQuality?: number;
  scoreContinuity?: number;
  scoreState?: number;
  scoreRegularity: number;
  scoreTotal: number;
  nap?: boolean | null;
  caffeine?: boolean | null;
  alcohol?: boolean | null;
  screenBeforeSleep?: boolean | null;
  pain?: boolean | null;
  notes?: string | null;
  classification?: string;
}
