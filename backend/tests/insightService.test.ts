declare const process: any;
import { buildChartInsights, buildHistoryInsights, buildStudentInsightDashboard, buildTeacherAlertsForStudent, calculateFatigueRiskOfficial } from '../src/services/insightService';
import { SleepRecordLike } from '../src/types/sleepRecord';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function hasType(alerts: Array<{ type: string }>, type: string) {
  return alerts.some((alert) => alert.type === type);
}
function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}
function record(days: number, score: number, overrides: Partial<SleepRecordLike> = {}): SleepRecordLike {
  return {
    id: 1000 + days,
    studentId: 1,
    date: daysAgo(days),
    totalHours: overrides.totalHours ?? (score < 55 ? 5.5 : 7.5),
    perceivedQuality: overrides.perceivedQuality ?? (score < 55 ? 2 : 4),
    awakenings: overrides.awakenings ?? (score < 55 ? 3 : 1),
    morningState: overrides.morningState ?? (score < 55 ? 1 : 4),
    energy: overrides.energy ?? (score < 55 ? 1 : 4),
    stress: overrides.stress ?? (score < 55 ? 5 : 2),
    mood: overrides.mood ?? (score < 55 ? 2 : 4),
    generalPain: overrides.generalPain ?? (score < 55 ? 4 : 2),
    bodyHeaviness: overrides.bodyHeaviness ?? (score < 55 ? 4 : 2),
    scoreDuration: 0,
    scoreQuality: 0,
    scoreContinuity: 0,
    scoreState: 0,
    scoreRegularity: overrides.scoreRegularity ?? (score < 55 ? 4 : 12),
    scoreTotal: score,
    ...overrides,
  };
}

const noAlerts = buildTeacherAlertsForStudent(1, 'Aluno Novo', []);
assert(noAlerts.length === 0, 'Aluno sem nenhum registro não deve gerar alerta falso de ausência.');

const oldRecordAlerts = buildTeacherAlertsForStudent(1, 'Aluno Sumido', [record(8, 75)]);
assert(hasType(oldRecordAlerts, 'no_record_3_days'), 'Aluno com registro antigo deve gerar alerta de 3 dias sem registro.');
assert(hasType(oldRecordAlerts, 'no_record_7_days'), 'Aluno com registro antigo deve gerar alerta de 7 dias sem registro.');

const twoBad = buildTeacherAlertsForStudent(1, 'Aluno Ruim', [record(0, 45), record(1, 50)]);
assert(hasType(twoBad, 'two_bad_nights'), 'Dois registros ruins consecutivos devem gerar two_bad_nights.');

const threeBad = buildTeacherAlertsForStudent(1, 'Aluno Instável', [record(0, 45), record(2, 50), record(4, 54)]);
assert(hasType(threeBad, 'three_bad_records_week'), 'Três registros ruins em 7 dias devem gerar three_bad_records_week.');

const critical = buildTeacherAlertsForStudent(1, 'Aluno Crítico', [record(0, 35), record(1, 52), record(2, 58)]);
assert(hasType(critical, 'critical_last_night'), 'Último score abaixo de 40 deve gerar critical_last_night.');

const fatigue = buildTeacherAlertsForStudent(1, 'Aluno Fadigado', [record(0, 35), record(1, 38), record(2, 42)]);
assert(hasType(fatigue, 'high_fatigue'), 'Cenário de fadiga elevada deve gerar high_fatigue.');
assert(hasType(fatigue, 'persistent_high_fatigue'), 'Fadiga alta em janelas recentes deve gerar persistent_high_fatigue.');

const risk = calculateFatigueRiskOfficial([record(0, 35), record(1, 45), record(2, 60)]);
assert(risk !== null && risk > 50, 'Risco oficial de fadiga precisa aumentar com score baixo, tendência de queda e energia baixa.');

const historyInsufficient = buildHistoryInsights([record(0, 80)]);
assert(historyInsufficient.length === 1 && historyInsufficient[0].id.includes('dados-insuficientes'), 'Histórico com menos de 3 registros precisa retornar dados insuficientes.');

const dashboard = buildStudentInsightDashboard([record(0, 80), record(1, 72), record(2, 68)], { hoursGoal: 8 });
assert(Array.isArray(dashboard.blocks) && dashboard.blocks.length >= 10, 'Tela de insights do aluno precisa retornar blocos organizados.');
assert(Array.isArray(dashboard.insights) && dashboard.insights.length >= 15, 'Tela de insights do aluno precisa retornar os insights oficiais.');

const chartInsights = buildChartInsights([record(0, 70), record(1, 90), record(2, 65), record(3, 75)]);
assert(chartInsights.some((item) => item.id === 'chart-worst-week-drop'), 'Gráficos precisam retornar insight de semana/trecho de maior queda.');

const completeHistory = buildHistoryInsights([record(0, 80, { totalHours: 5.8 }), record(1, 72), record(2, 62), record(3, 50, { scoreRegularity: 4 }), record(4, 88, { scoreRegularity: 12 })]);
const requiredHistoryTitles = ['Melhor registro do período','Registro mais baixo do período','Sequência positiva de recuperação','Sequência de baixa recuperação','Evolução positiva no período','Tendência de queda no período','Padrão de sono estável','Padrão de sono irregular','Histórico com dados insuficientes','Boa resposta mesmo com sono reduzido','Sono longo com baixa recuperação','Despertares associados à queda do score','Regularidade em melhora','Regularidade em queda','Energia ao acordar instável'];
for (const title of requiredHistoryTitles) assert(completeHistory.some((item) => item.title === title), `Histórico precisa conter: ${title}`);

const fullChartInsights = buildChartInsights([record(0, 70), record(3, 90), record(7, 65), record(10, 75), record(15, 45), record(22, 82)]);
const requiredChartTitles = ['Tendência positiva do score','Tendência de queda do score','Score estável no período','Alta oscilação dos resultados','Pico positivo do período','Ponto mais baixo do período','Recuperação corporal em melhora','Recuperação corporal em queda','Fadiga geral em aumento','Fadiga geral em redução','Foco mental em queda','Estado de alerta em queda','Risco de sobrecarga em aumento','Relação entre horas dormidas e score','Impacto dos despertares no score','Relação entre estresse e score','Semana de melhor evolução','Semana de maior queda'];
for (const title of requiredChartTitles) assert(fullChartInsights.some((item) => item.title === title), `Gráficos precisam conter: ${title}`);

const studentInsightTitles = buildStudentInsightDashboard([record(0, 80), record(1, 72), record(2, 68), record(8, 55), record(9, 50), record(10, 60)], { hoursGoal: 8 }).insights.map((item) => item.title);
const requiredExistingTitles = ['Seu corpo está pronto para receber carga?','Conduta sugerida para hoje','Prontidão para treinar hoje','Risco de fadiga acumulada','Recuperação corporal','Consistência de registros','O que formou seu score?','Como interpretar seu score','Regularidade de registros caiu','Registros mais consistentes'];
for (const title of requiredExistingTitles) assert(studentInsightTitles.includes(title), `Insights existentes precisam conter: ${title}`);

const backendAlertTitles = buildTeacherAlertsForStudent(1, 'Aluno Backend', [record(0, 10), record(1, 25), record(2, 50), record(8, 80), record(9, 78), record(10, 76)], { hoursGoal: 8 }).map((item) => item.title);
const requiredBackendAlertTitles = ['Média semanal em zona de atenção','Queda relevante na média semanal','Três registros seguidos em baixa recuperação','Déficit médio de sono','Baixa consistência de registros','Prontidão baixa para treinar','Recuperação corporal reduzida','Baixo estado de alerta','Foco mental reduzido','Risco elevado de fadiga acumulada'];
for (const title of requiredBackendAlertTitles) assert(backendAlertTitles.includes(title), `Alertas do backend precisam conter: ${title}`);

console.log('Testes de insights, alertas oficiais e dados insuficientes concluídos com sucesso.');
process.exit(0);
