declare const process: any;
import { buildOwnerTeachersDashboard } from '../src/services/ownerDashboardService';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function eq<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message}. Esperado ${expected}, recebido ${actual}`);
}

const reference = new Date('2026-05-02T12:00:00.000Z');
const record = (date: string, score: number | null, energy = 3) => ({
  id: date,
  studentId: 1,
  date: new Date(`${date}T00:00:00.000Z`),
  scoreTotal: score,
  scoreDuration: 20,
  scoreQuality: 20,
  scoreContinuity: 10,
  scoreState: 10,
  scoreRegularity: 5,
  totalHours: 7,
  energy,
  perceivedQuality: 3,
  awakenings: 1,
  morningState: 3,
  classification: 'Teste',
  createdAt: new Date(`${date}T08:00:00.000Z`),
});

const dashboard = buildOwnerTeachersDashboard([
  {
    id: 1,
    userId: 10,
    user: { id: 10, name: 'Criador', email: 'criador@app.com', active: true, createdAt: new Date('2026-01-01T00:00:00.000Z') },
    students: [
      { id: 101, user: { name: 'Aluno Forte', email: 'forte@app.com' }, status: 'active', sleepRecords: [record('2026-05-01', 90), record('2026-04-30', 88), record('2026-04-29', 92)], sleepGoals: [] },
      { id: 102, user: { name: 'Aluno Risco', email: 'risco@app.com' }, status: 'active', sleepRecords: [record('2026-05-01', 35, 1), record('2026-04-30', 42, 1), record('2026-04-29', 50, 1)], sleepGoals: [{ id: 1, hoursGoal: 8, active: true }] },
      { id: 103, user: { name: 'Arquivado', email: 'arquivado@app.com' }, status: 'archived', sleepRecords: [], sleepGoals: [] },
    ],
  },
  {
    id: 2,
    userId: 20,
    user: { id: 20, name: 'Professor Sem Alunos', email: 'sem@app.com', active: true },
    students: [],
  },
], reference);

eq(dashboard.overview.totalTeachers, 2, 'Dashboard do criador precisa contar professores');
eq(dashboard.overview.activeStudents, 2, 'Dashboard precisa contar apenas alunos ativos em activeStudents');
eq(dashboard.overview.archivedStudents, 1, 'Dashboard precisa contar alunos arquivados');
eq(dashboard.overview.teachersWithoutStudents, 1, 'Dashboard precisa apontar professores sem alunos');
eq(dashboard.teachers[0].teacherId, 1, 'Professor com maior atencao deve aparecer primeiro');
assert(dashboard.teachers[0].attentionScore > 0, 'Professor com aluno em risco precisa ter score de atencao');
eq(dashboard.teachers[0].students.length, 3, 'Ao clicar em professor, API precisa entregar a lista de alunos dele');
eq(dashboard.teachers.find((teacher) => teacher.teacherId === 2)?.operationalStatus, 'sem_alunos', 'Professor sem alunos precisa ter status operacional correto');
assert(dashboard.rankings.byStudents[0].activeStudents >= dashboard.rankings.byStudents[1].activeStudents, 'Ranking por alunos precisa vir ordenado');

console.log('Testes do dashboard de professores do criador concluidos com sucesso.');
process.exit(0);
