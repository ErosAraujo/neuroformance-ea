declare const process: any;
import { calculateDurationScore, calculateQualityScore, calculateContinuityScore, calculateStateScore, calculateRegularityScore, calculateSleepScore, classifyScore, getFatigueRisk, getRecoveryLevel } from '../src/services/scoreService';
import { calculateTotalHours, parseDateOnly } from '../src/services/timeService';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function eq<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message}. Esperado ${expected}, recebido ${actual}`);
}

// Duração: limites oficiais.
eq(calculateDurationScore(3.99), 0, 'Duração menor que 4h');
eq(calculateDurationScore(4), 5, 'Duração 4h');
eq(calculateDurationScore(5), 10, 'Duração 5h');
eq(calculateDurationScore(6), 17, 'Duração 6h');
eq(calculateDurationScore(7), 25, 'Duração 7h');
eq(calculateDurationScore(8.5), 25, 'Duração 8,5h');
eq(calculateDurationScore(8.51), 22, 'Duração acima de 8,5h');
eq(calculateDurationScore(9.5), 22, 'Duração 9,5h');
eq(calculateDurationScore(9.51), 18, 'Duração acima de 9,5h');

// Demais pilares.
eq(calculateQualityScore(1), 5, 'Qualidade 1');
eq(calculateQualityScore(5), 25, 'Qualidade 5');
eq(calculateContinuityScore(0), 20, 'Continuidade 0 despertar');
eq(calculateContinuityScore(4), 4, 'Continuidade 4 despertares');
eq(calculateStateScore(1), 3, 'Estado 1');
eq(calculateStateScore(5), 15, 'Estado 5');
eq(calculateRegularityScore(30), 15, 'Regularidade 30 min');
eq(calculateRegularityScore(31), 10, 'Regularidade 31 min');
eq(calculateRegularityScore(61), 5, 'Regularidade 61 min');
eq(calculateRegularityScore(121), 0, 'Regularidade 121 min');

// Classificação final.
eq(classifyScore(100), 'Excelente', 'Classificação 100');
eq(classifyScore(85), 'Excelente', 'Classificação 85');
eq(classifyScore(84), 'Bom', 'Classificação 84');
eq(classifyScore(70), 'Bom', 'Classificação 70');
eq(classifyScore(69), 'Regular', 'Classificação 69');
eq(classifyScore(55), 'Regular', 'Classificação 55');
eq(classifyScore(54), 'Ruim', 'Classificação 54');
eq(classifyScore(40), 'Ruim', 'Classificação 40');
eq(classifyScore(39), 'Crítico', 'Classificação 39');

// Comunicação nova da Home do aluno.
eq(getRecoveryLevel(85), 'Excelente', 'Nível de recuperação 85');
eq(getRecoveryLevel(70), 'Alto', 'Nível de recuperação 70');
eq(getRecoveryLevel(55), 'Médio', 'Nível de recuperação 55');
eq(getRecoveryLevel(40), 'Baixo', 'Nível de recuperação 40');
eq(getRecoveryLevel(39), 'Crítico', 'Nível de recuperação 39');
eq(getFatigueRisk(85), 'Muito Baixo', 'Risco de cansaço 85');
eq(getFatigueRisk(70), 'Baixo', 'Risco de cansaço 70');
eq(getFatigueRisk(55), 'Moderado', 'Risco de cansaço 55');
eq(getFatigueRisk(40), 'Alto', 'Risco de cansaço 40');
eq(getFatigueRisk(39), 'Elevado', 'Risco de cansaço 39');

// Score total.
const excellent = calculateSleepScore({ totalHours: 8, perceivedQuality: 5, awakenings: 0, morningState: 5, regularityVariation: 20 });
eq(excellent.total, 100, 'Score excelente');
eq(excellent.classification, 'Excelente', 'Classificação excelente');
const critical = calculateSleepScore({ totalHours: 3.5, perceivedQuality: 1, awakenings: 5, morningState: 1, regularityVariation: 180 });
eq(critical.total, 12, 'Score crítico');
eq(critical.classification, 'Crítico', 'Classificação crítica');

// Horários e datas.
eq(calculateTotalHours('2024-04-20', '23:00', '07:00').totalHours, 8, 'Sono atravessando meia-noite');
eq(calculateTotalHours('2024-04-20', '22:30', '06:00').totalHours, 7.5, 'TotalHours com meia hora');
let invalidDateBlocked = false;
try { parseDateOnly('2024-99-99'); } catch { invalidDateBlocked = true; }
assert(invalidDateBlocked, 'Data inexistente precisa ser bloqueada');

console.log('Testes do Score do Sono, datas e horários concluídos com sucesso.');

process.exit(0);
