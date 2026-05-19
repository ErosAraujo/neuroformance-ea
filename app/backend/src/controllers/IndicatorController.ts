import { Response } from 'express';
import prisma from '../models/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getStudentIdByUserId } from '../services/identityService';
import { calculateDailyIndicators } from '../services/indicatorService';

export class IndicatorController {
  static async dailyIndicators(req: AuthRequest, res: Response) {
    if (!req.user || req.user.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar indicadores.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const lastThreeDesc = await prisma.sleepRecord.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 3 });
      const indicators = calculateDailyIndicators([...lastThreeDesc].reverse());
      if (!indicators.hasData) return res.json({ ...indicators, message: 'Nenhum registro encontrado. Registre suas noites para calcular indicadores.' });
      return res.json(indicators);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao calcular indicadores.' });
    }
  }

  static async historyIndicators(req: AuthRequest, res: Response) {
    if (!req.user || req.user.profile !== 'student') return res.status(403).json({ message: 'Apenas alunos podem acessar indicadores.' });
    try {
      const studentId = await getStudentIdByUserId(req.user.id);
      const rawDays = Number(req.query.days ?? 30);
      const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.round(rawDays), 1), 90) : 30;
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - (days + 2));
      from.setUTCHours(0, 0, 0, 0);

      const records = await prisma.sleepRecord.findMany({
        where: { studentId, date: { gte: from } },
        orderBy: { date: 'asc' },
      });

      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      const visibleFrom = new Date();
      visibleFrom.setUTCDate(visibleFrom.getUTCDate() - (days - 1));
      visibleFrom.setUTCHours(0, 0, 0, 0);

      const history = records
        .map((record, index) => {
          const base = records.slice(Math.max(0, index - 2), index + 1);
          const indicators = calculateDailyIndicators(base);
          return {
            date: record.date,
            scoreTotal: record.scoreTotal,
            totalHours: record.totalHours,
            classification: record.classification,
            generalStatusScore: indicators.generalStatusScore,
            generalStatusClassification: indicators.generalStatusClassification,
            readinessScore: indicators.readinessScore,
            readinessClassification: indicators.readinessClassification,
            recovery: indicators.recovery,
            fatigue: indicators.fatigue,
            alertness: indicators.alertness,
            mentalFocus: indicators.mentalFocus,
            overloadRisk: indicators.overloadRisk,
            recordsUsed: indicators.recordsUsed,
            baseReduced: indicators.baseReduced,
          };
        })
        .filter((item) => {
          const date = new Date(item.date);
          return date >= visibleFrom && date <= today;
        });

      return res.json({ days, records: history });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao calcular histórico de indicadores.' });
    }
  }

}
