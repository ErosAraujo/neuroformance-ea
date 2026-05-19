import { Router } from 'express';
import { IndicatorController } from '../controllers/IndicatorController';

const router = Router();

// Rota para obter indicadores diários do aluno logado.
router.get('/daily', IndicatorController.dailyIndicators);
router.get('/history', IndicatorController.historyIndicators);

export default router;