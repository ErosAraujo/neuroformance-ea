declare const process: any;
import {
  averageScores,
  buildTeacherDashboardSummary,
  calculateFatigueRisk,
  calculateGoalNotMet,
  calculateRiskStudent,
  generateTeacherAlerts,
  getLastValidRecords,
  isToday,
  isExpectedSleepCheckInRecordDate,
  safeScore,
} from '../src/services/teacherDashboardService';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function eq<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message}. Esperado ${expected}, recebido ${actual}`);
}

const reference = new Date('2026-05-02T12:00:00.000Z');
const record = (date: string, score: number | null, totalHours = 7, energy: number | null = 3) => ({
  id: date,
  studentId: 1,
  date: new Date(`${date}T00:00:00.000Z`),
  scoreTotal: score,
  scoreDuration: 22,
  scoreQuality: 20,
  scoreContinuity: 12,
  scoreState: 12,
  scoreRegularity: 5,
  totalHours,
  energy,
  perceivedQuality: 3,
  awakenings: 1,
  morningState: 3,
  classification: 'Teste',
  sleepTime: new Date(`${date}T23:00:00.000Z`),
  wakeTime: new Date(`${date}T07:00:00.000Z`),
  createdAt: new Date(`${date}T08:00:00.000Z`),
});

eq(safeScore(null), null, 'Score null não pode virar 0');
eq(safeScore(0), 0, 'Score 0 válido precisa continuar 0');
eq(getLastValidRecords([record('2026-05-02', null), record('2026-05-01', 80)], 3).length, 1, 'Registros com score null devem ser ignorados nos cálculos de score');
eq(averageScores([record('2026-05-02', null)]), null, 'Média sem score válido precisa retornar null');
assert(isToday(new Date('2026-05-02T00:00:00.000Z'), reference), 'Registro de hoje deve continuar reconhecido pela data local do app');
assert(isExpectedSleepCheckInRecordDate(new Date('2026-05-01T00:00:00.000Z'), reference), 'Check-in de hoje deve reconhecer a data da noite anterior.');
assert(!isExpectedSleepCheckInRecordDate(new Date('2026-05-02T00:00:00.000Z'), reference), 'Registro com data do próprio dia não deve entrar no check-in esperado de hoje.');

const withoutRecords = { id: 1, user: { name: 'Sem Registro', email: 'sem@teste.com' }, sleepRecords: [], sleepGoals: [] };
const withoutRecordsSummary = buildTeacherDashboardSummary([withoutRecords], reference);
eq(withoutRecordsSummary.totalStudents, 1, 'Aluno sem registro não pode quebrar resumo');
eq(withoutRecordsSummary.students[0].averageLast3Score, null, 'Aluno sem registro deve ficar sem média');
eq(withoutRecordsSummary.students[0].fatigueRiskLevel, 'insuficiente', 'Aluno sem registro deve ter fadiga insuficiente');

const highScoreStudent = { id: 2, user: { name: 'Score Alto', email: 'alto@teste.com' }, sleepRecords: [record('2026-05-02', 92), record('2026-05-01', 90), record('2026-04-30', 88)], sleepGoals: [] };
assert(!calculateRiskStudent(highScoreStudent), 'Score alto não pode entrar como aluno em risco');

const mappedSummary = buildTeacherDashboardSummary([highScoreStudent], reference);
eq(mappedSummary.students[0].lastRecord?.scoreDuration, 22, 'Rota consolidada deve preservar scoreDuration do registro');
eq(mappedSummary.students[0].lastRecord?.scoreQuality, 20, 'Rota consolidada deve preservar scoreQuality do registro');
eq(mappedSummary.students[0].lastRecord?.scoreContinuity, 12, 'Rota consolidada deve preservar scoreContinuity do registro');
eq(mappedSummary.students[0].lastRecord?.scoreState, 12, 'Rota consolidada deve preservar scoreState do registro');
eq(mappedSummary.students[0].lastRecord?.scoreRegularity, 5, 'Rota consolidada deve preservar scoreRegularity do registro');

const riskStudent = { id: 3, user: { name: 'Risco', email: 'risco@teste.com' }, sleepRecords: [record('2026-05-02', 38), record('2026-05-01', 65), record('2026-04-30', 70)], sleepGoals: [] };
assert(calculateRiskStudent(riskStudent), 'Último score abaixo de 40 deve ativar aluno em risco');

const noGoalStudent = { id: 4, user: { name: 'Sem Meta', email: 'meta@teste.com' }, sleepRecords: [record('2026-05-02', 80, 5)], sleepGoals: [] };
assert(!calculateGoalNotMet(noGoalStudent, reference).isGoalNotMet, 'Aluno sem meta não pode entrar como meta não cumprida');

const goalStudent = {
  id: 5,
  user: { name: 'Com Meta', email: 'goal@teste.com' },
  sleepRecords: [record('2026-05-02', 75, 5.5), record('2026-05-01', 74, 5.8), record('2026-04-30', 73, 5.7)],
  sleepGoals: [{ id: 1, hoursGoal: 7, active: true, createdAt: new Date('2026-04-01T00:00:00.000Z') }],
};
assert(calculateGoalNotMet(goalStudent, reference).isGoalNotMet, 'Média real abaixo da meta ativa deve marcar meta não cumprida');
assert(calculateGoalNotMet(goalStudent, reference).isSevereDeficit, 'Mais de 1h abaixo da meta deve marcar déficit severo');

const absentEnergyStudent = { id: 6, user: { name: 'Energia Ausente', email: 'energy@teste.com' }, sleepRecords: [record('2026-05-02', 60, 7, null), record('2026-05-01', 58, 7, 3), record('2026-04-30', 56, 7, 3)], sleepGoals: [] };
eq(calculateFatigueRisk(absentEnergyStudent).level, 'insuficiente', 'Energia ausente no registro recente deve gerar fadiga insuficiente');

const alertStudent = {
  id: 7,
  user: { name: 'Alertas', email: 'alertas@teste.com' },
  sleepRecords: [record('2026-05-02', 35, 5, 1), record('2026-05-01', 45, 5, 1), record('2026-04-30', 50, 5, 1)],
  sleepGoals: [{ id: 2, hoursGoal: 7, active: true, createdAt: new Date('2026-04-01T00:00:00.000Z') }],
};
const alertTypes = generateTeacherAlerts(alertStudent, reference).map((alert) => alert.type);
['SCORE_CRITICO_ULTIMA_NOITE', 'DUAS_NOITES_RUINS', 'MEDIA_SEMANAL_BAIXA', 'SEM_ENERGIA_3_NOITES', 'PRONTIDAO_BAIXA_HOJE', 'DEFICIT_SEVERO_SONO', 'NECESSITA_CONTATO_PROFESSOR'].forEach((type) => {
  assert(alertTypes.includes(type), `Alerta obrigatório ausente: ${type}`);
});

const summary = buildTeacherDashboardSummary([withoutRecords, highScoreStudent, riskStudent, goalStudent, alertStudent], reference);
eq(summary.registeredToday, 4, 'Contagem de alunos que registraram hoje precisa usar a data da noite anterior');
assert(summary.riskStudents >= 2, 'Resumo precisa contar alunos em risco');
assert(summary.topWorstRecoveries.length <= 3, 'Top piores recuperações deve retornar no máximo 3 alunos');
assert(summary.studentsWithAlerts >= 1, 'Resumo precisa consolidar alertas oficiais');

console.log('Testes do dashboard consolidado do professor concluídos com sucesso.');
process.exit(0);
