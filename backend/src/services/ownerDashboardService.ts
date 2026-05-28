import {
  StudentLike,
  averageScores,
  buildTeacherDashboardSummary,
  getLastValidRecords,
  getRecordsLastDays,
  safeScore,
} from './teacherDashboardService';

export interface OwnerTeacherInput {
  id: number;
  userId?: number | null;
  user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
    photoUrl?: string | null;
    active?: boolean | null;
    createdAt?: Date | string | null;
  } | null;
  students?: (StudentLike & {
    status?: string | null;
    active?: boolean | null;
    createdAt?: Date | string | null;
  })[];
}

type OwnerStudentInput = NonNullable<OwnerTeacherInput['students']>[number];

export interface OwnerTeacherMetric {
  teacherId: number;
  userId: number | null;
  name: string;
  email: string;
  photoUrl?: string | null;
  active: boolean;
  createdAt: string | null;
  teacherCode: string;
  totalStudents: number;
  activeStudents: number;
  archivedStudents: number;
  deletedStudents: number;
  registeredToday: number;
  riskStudents: number;
  lowAdherenceStudents: number;
  criticalAdherenceStudents: number;
  studentsWithAlerts: number;
  totalActiveAlerts: number;
  studentsWithoutRecords: number;
  averageReadiness: number | null;
  recordsLast7Days: number;
  attentionScore: number;
  operationalStatus: 'sem_alunos' | 'estavel' | 'atencao' | 'critico';
  lastActivityAt: string | null;
  studentHighlights: {
    risk: { id: number | string; name: string; email: string; photoUrl?: string | null; score: number | null }[];
    lowAdherence: { id: number | string; name: string; email: string; photoUrl?: string | null; recordsLast7Days: number }[];
    withoutRecords: { id: number | string; name: string; email: string; photoUrl?: string | null }[];
  };
  students: {
    id: number | string;
    name: string;
    email: string;
    photoUrl?: string | null;
    status: string;
    latestRecordDate: string | null;
    averageScore: number | null;
    recordsLast7Days: number;
  }[];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatus(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function studentStatus(student: OwnerStudentInput) {
  const status = normalizeStatus((student as any).status);
  if (status === 'archived' || status === 'deleted') return status;
  if ((student as any).active === false) return 'archived';
  return 'active';
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function averageReadiness(students: any[]) {
  const values = students
    .map((student) => safeScore(student.averageLast3Score) ?? safeScore(student.readinessScore))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
}

function latestStudentActivity(students: NonNullable<OwnerTeacherInput['students']>) {
  const dates = students.flatMap((student) => [
    (student as any).createdAt,
    ...((student.sleepRecords || []).flatMap((record) => [record.date, record.createdAt])),
  ]).map((value) => {
    const iso = toIso(value);
    return iso ? new Date(iso).getTime() : 0;
  }).filter(Boolean);
  if (!dates.length) return null;
  return new Date(Math.max(...dates)).toISOString();
}

function studentIdentity(student: any) {
  return {
    id: student.id,
    name: student.user?.name || student.name || '',
    email: student.user?.email || student.email || '',
    photoUrl: student.user?.photoUrl || student.photoUrl || null,
  };
}

function buildStudentHighlights(students: NonNullable<OwnerTeacherInput['students']>, reference: Date) {
  const activeStudents = students.filter((student) => studentStatus(student) === 'active');
  const risk = activeStudents
    .map((student) => {
      const score = averageScores(getLastValidRecords(student.sleepRecords || [], 3));
      const latest = getLastValidRecords(student.sleepRecords || [], 1)[0];
      const latestScore = latest ? safeScore(latest.scoreTotal) : null;
      const finalScore = score ?? latestScore;
      return { ...studentIdentity(student), score: finalScore };
    })
    .filter((student) => student.score !== null && student.score < 55)
    .sort((a, b) => (a.score ?? 101) - (b.score ?? 101))
    .slice(0, 5);

  const lowAdherence = activeStudents
    .map((student) => ({ ...studentIdentity(student), recordsLast7Days: getRecordsLastDays(student.sleepRecords || [], 7, reference).length }))
    .filter((student) => student.recordsLast7Days < 3)
    .sort((a, b) => a.recordsLast7Days - b.recordsLast7Days)
    .slice(0, 5);

  const withoutRecords = activeStudents
    .filter((student) => !(student.sleepRecords || []).length)
    .map(studentIdentity)
    .slice(0, 5);

  return { risk, lowAdherence, withoutRecords };
}

function buildTeacherStudents(students: NonNullable<OwnerTeacherInput['students']>, reference: Date) {
  return students.map((student) => {
    const records = student.sleepRecords || [];
    const latest = getLastValidRecords(records, 1)[0] || records[0];
    const averageScore = averageScores(getLastValidRecords(records, 3));
    return {
      ...studentIdentity(student),
      status: studentStatus(student),
      latestRecordDate: toIso(latest?.date || latest?.createdAt),
      averageScore: averageScore ?? null,
      recordsLast7Days: getRecordsLastDays(records, 7, reference).length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function operationalStatus(metric: Pick<OwnerTeacherMetric, 'activeStudents' | 'riskStudents' | 'lowAdherenceStudents' | 'studentsWithAlerts'>): OwnerTeacherMetric['operationalStatus'] {
  if (!metric.activeStudents) return 'sem_alunos';
  const riskRatio = metric.riskStudents / metric.activeStudents;
  const adherenceRatio = metric.lowAdherenceStudents / metric.activeStudents;
  if (riskRatio >= 0.35) return 'critico';
  if (metric.studentsWithAlerts > 0 || adherenceRatio >= 0.35) return 'atencao';
  return 'estavel';
}

export function buildOwnerTeachersDashboard(
  teachers: OwnerTeacherInput[],
  reference = new Date(),
) {
  const teacherMetrics: OwnerTeacherMetric[] = teachers.map((teacher) => {
    const students = teacher.students || [];
    const activeStudents = students.filter((student) => studentStatus(student) === 'active');
    const archivedStudents = students.filter((student) => studentStatus(student) === 'archived');
    const deletedStudents = students.filter((student) => studentStatus(student) === 'deleted');
    const dashboardSummary = buildTeacherDashboardSummary(activeStudents, reference);
    const recordsLast7Days = activeStudents.reduce((sum, student) => sum + getRecordsLastDays(student.sleepRecords || [], 7, reference).length, 0);
    const baseMetric = {
      teacherId: teacher.id,
      userId: teacher.userId ?? teacher.user?.id ?? null,
      name: teacher.user?.name || `Professor ${teacher.id}`,
      email: teacher.user?.email || '',
      photoUrl: teacher.user?.photoUrl || null,
      active: teacher.user?.active !== false,
      createdAt: toIso(teacher.user?.createdAt),
      teacherCode: String(teacher.id),
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      archivedStudents: archivedStudents.length,
      deletedStudents: deletedStudents.length,
      registeredToday: dashboardSummary.registeredToday,
      riskStudents: dashboardSummary.riskStudents,
      lowAdherenceStudents: dashboardSummary.lowAdherenceStudents,
      criticalAdherenceStudents: dashboardSummary.criticalAdherenceStudents,
      studentsWithAlerts: dashboardSummary.studentsWithAlerts,
      totalActiveAlerts: dashboardSummary.totalActiveAlerts,
      studentsWithoutRecords: activeStudents.filter((student) => !(student.sleepRecords || []).length).length,
      averageReadiness: averageReadiness(dashboardSummary.students),
      recordsLast7Days,
      attentionScore: dashboardSummary.riskStudents + dashboardSummary.lowAdherenceStudents + dashboardSummary.studentsWithAlerts,
      operationalStatus: 'estavel' as OwnerTeacherMetric['operationalStatus'],
      lastActivityAt: latestStudentActivity(students),
      studentHighlights: buildStudentHighlights(students, reference),
      students: buildTeacherStudents(students, reference),
    };
    return {
      ...baseMetric,
      operationalStatus: operationalStatus(baseMetric),
    };
  }).sort((a, b) => b.attentionScore - a.attentionScore || b.activeStudents - a.activeStudents || a.name.localeCompare(b.name));

  const activeTeachers = teacherMetrics.filter((teacher) => teacher.active);
  const totalActiveStudents = teacherMetrics.reduce((sum, teacher) => sum + teacher.activeStudents, 0);

  return {
    generatedAt: reference.toISOString(),
    overview: {
      totalTeachers: teacherMetrics.length,
      activeTeachers: activeTeachers.length,
      inactiveTeachers: teacherMetrics.length - activeTeachers.length,
      teachersWithoutStudents: teacherMetrics.filter((teacher) => teacher.activeStudents === 0).length,
      totalStudents: teacherMetrics.reduce((sum, teacher) => sum + teacher.totalStudents, 0),
      activeStudents: totalActiveStudents,
      archivedStudents: teacherMetrics.reduce((sum, teacher) => sum + teacher.archivedStudents, 0),
      deletedStudents: teacherMetrics.reduce((sum, teacher) => sum + teacher.deletedStudents, 0),
      registeredToday: teacherMetrics.reduce((sum, teacher) => sum + teacher.registeredToday, 0),
      riskStudents: teacherMetrics.reduce((sum, teacher) => sum + teacher.riskStudents, 0),
      lowAdherenceStudents: teacherMetrics.reduce((sum, teacher) => sum + teacher.lowAdherenceStudents, 0),
      studentsWithAlerts: teacherMetrics.reduce((sum, teacher) => sum + teacher.studentsWithAlerts, 0),
      totalActiveAlerts: teacherMetrics.reduce((sum, teacher) => sum + teacher.totalActiveAlerts, 0),
      averageStudentsPerTeacher: teacherMetrics.length ? round(totalActiveStudents / teacherMetrics.length, 1) : 0,
    },
    rankings: {
      byStudents: [...teacherMetrics].sort((a, b) => b.activeStudents - a.activeStudents).slice(0, 5),
      byAttention: [...teacherMetrics].sort((a, b) => b.attentionScore - a.attentionScore).slice(0, 5),
    },
    teachers: teacherMetrics,
  };
}
