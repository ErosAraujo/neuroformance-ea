/**
 * Serviço responsável por calcular o Score do Sono conforme a especificação.
 * Cada pilar retorna uma pontuação parcial. A função calculateSleepScore
 * retorna todas as pontuações individuais, o total e a classificação.
 */

export interface ScoreResult {
  duration: number;
  quality: number;
  continuity: number;
  state: number;
  regularity: number;
  total: number;
  classification: string;
}

/**
 * Traduz o score numérico para uma linguagem mais útil ao aluno.
 * Essa função é diferente da classificação técnica antiga: aqui "Bom"
 * passa a ser comunicado como "Alto", deixando a Home mais clara.
 */
export function getRecoveryLevel(score: number): 'Excelente' | 'Alto' | 'Médio' | 'Baixo' | 'Crítico' {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Alto';
  if (score >= 55) return 'Médio';
  if (score >= 40) return 'Baixo';
  return 'Crítico';
}

/**
 * Define risco de cansaço a partir da prontidão. Quanto maior a prontidão,
 * menor o risco. A prontidão da Home usa média das últimas 3 noites.
 */
export function getFatigueRisk(score: number): 'Muito Baixo' | 'Baixo' | 'Moderado' | 'Alto' | 'Elevado' {
  if (score >= 85) return 'Muito Baixo';
  if (score >= 70) return 'Baixo';
  if (score >= 55) return 'Moderado';
  if (score >= 40) return 'Alto';
  return 'Elevado';
}

/** Calcula a pontuação de duração do sono com base no total de horas. */
export function calculateDurationScore(hours: number): number {
  if (hours < 4) return 0;
  if (hours < 5) return 5;
  if (hours < 6) return 10;
  if (hours < 7) return 17;
  if (hours <= 8.5) return 25;
  if (hours <= 9.5) return 22;
  return 18;
}

/**
 * Calcula a pontuação de qualidade percebida (escala 1–5).
 */
export function calculateQualityScore(quality: number): number {
  switch (quality) {
    case 1: return 5;
    case 2: return 10;
    case 3: return 15;
    case 4: return 20;
    case 5: return 25;
    default: return 0;
  }
}

/**
 * Calcula a pontuação de continuidade com base no número de despertares.
 */
export function calculateContinuityScore(awakenings: number): number {
  if (awakenings <= 0) return 20;
  if (awakenings === 1) return 16;
  if (awakenings === 2) return 12;
  if (awakenings === 3) return 8;
  return 4;
}

/**
 * Calcula a pontuação do estado ao acordar (escala 1–5). Utiliza valores
 * discretizados conforme especificação.
 */
export function calculateStateScore(state: number): number {
  switch (state) {
    case 1: return 3;
    case 2: return 6;
    case 3: return 9;
    case 4: return 12;
    case 5: return 15;
    default: return 0;
  }
}

/**
 * Calcula a pontuação de regularidade. Recebe o desvio em minutos entre
 * o horário de dormir/acordar da noite atual e a média dos últimos 7 dias.
 */
export function calculateRegularityScore(variationMinutes: number): number {
  if (variationMinutes <= 30) return 15;
  if (variationMinutes <= 60) return 10;
  if (variationMinutes <= 120) return 5;
  return 0;
}

/**
 * Define a classificação final do score total.
 */
export function classifyScore(total: number): string {
  if (total >= 85) return 'Excelente';
  if (total >= 70) return 'Bom';
  if (total >= 55) return 'Regular';
  if (total >= 40) return 'Ruim';
  return 'Crítico';
}

/**
 * Calcula todas as pontuações e devolve o resultado completo. Recebe o
 * total de horas, qualidade percebida, número de despertares, estado ao
 * acordar e variação de regularidade. A regularidade deve ser
 * calculada na camada de serviço usando histórico do aluno.
 */
export function calculateSleepScore(params: {
  totalHours: number;
  perceivedQuality: number;
  awakenings: number;
  morningState: number;
  regularityVariation: number;
}): ScoreResult {
  const duration = calculateDurationScore(params.totalHours);
  const quality = calculateQualityScore(params.perceivedQuality);
  const continuity = calculateContinuityScore(params.awakenings);
  const state = calculateStateScore(params.morningState);
  const regularity = calculateRegularityScore(params.regularityVariation);
  const total = duration + quality + continuity + state + regularity;
  const classification = classifyScore(total);
  return { duration, quality, continuity, state, regularity, total, classification };
}