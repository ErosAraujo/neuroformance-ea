import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';
import { buildChartInsights, buildHistoryInsights, buildStudentInsightDashboard } from '../services/insightService';

async function getStudentRecordsAndGoal(studentId: number) {
  const [records, activeGoal] = await Promise.all([
    prisma.sleepRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' } }),
    prisma.sleepGoal.findFirst({ where: { studentId, active: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  return { records, activeGoal };
}

function parseDateKey(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function recordDateKey(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function filterRecordsByQuery(records: any[], query: Record<string, unknown>) {
  const daysRaw = typeof query.days === 'string' ? Number(query.days) : undefined;
  const start = parseDateKey(query.start);
  const end = parseDateKey(query.end);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let fromKey: string | null = null;
  let toKey: string | null = null;
  if (Number.isFinite(daysRaw) && Number(daysRaw) > 0) {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - Math.max(0, Number(daysRaw) - 1));
    fromKey = from.toISOString().slice(0, 10);
    toKey = today.toISOString().slice(0, 10);
  } else {
    fromKey = start;
    toKey = end;
  }
  if (!fromKey && !toKey) return records;
  return records.filter((record) => {
    const key = recordDateKey(record.date);
    if (!key) return false;
    if (fromKey && key < fromKey) return false;
    if (toKey && key > toKey) return false;
    return true;
  });
}

export class InsightsController {
  static async mine(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar insights.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const { records, activeGoal } = await getStudentRecordsAndGoal(studentId);
      const scopedRecords = filterRecordsByQuery(records, req.query as Record<string, unknown>);
      return res.json(buildStudentInsightDashboard(scopedRecords, activeGoal));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar insights.' });
    }
  }

  static async history(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar histórico de insights.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const { records } = await getStudentRecordsAndGoal(studentId);
      const scopedRecords = filterRecordsByQuery(records, req.query as Record<string, unknown>);
      return res.json({ insights: buildHistoryInsights(scopedRecords) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar insights do histórico.' });
    }
  }

  static async charts(req: AuthRequest, res: Response) {
    if (req.user?.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar insights de gráficos.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const { records } = await getStudentRecordsAndGoal(studentId);
      const scopedRecords = filterRecordsByQuery(records, req.query as Record<string, unknown>);
      return res.json({ insights: buildChartInsights(scopedRecords) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao gerar insights dos gráficos.' });
    }
  }
}
