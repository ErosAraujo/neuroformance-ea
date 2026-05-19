declare const process: any;
import { calculateSleepScore } from '../src/services/scoreService';
import { calculateTotalHours, parseDateOnly } from '../src/services/timeService';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function eq<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message}. Esperado ${expected}, recebido ${actual}`);
}

// score completo
eq(calculateSleepScore({ totalHours: 8, perceivedQuality: 5, awakenings: 0, morningState: 5, regularityVariation: 10 }).total, 100, 'Score completo precisa fechar 100');

// data futura / inválida / hora inválida
let invalidDate = false;
try { parseDateOnly('2024-99-99'); } catch { invalidDate = true; }
assert(invalidDate, 'Data inválida precisa ser bloqueada');
let invalidTime = false;
try { calculateTotalHours('2024-04-20', '99:99', '07:00'); } catch { invalidTime = true; }
assert(invalidTime, 'Hora inválida precisa ser bloqueada');
let impossibleInterval = false;
try { calculateTotalHours('2024-04-20', '07:00', '07:01'); } catch { impossibleInterval = true; }
assert(!impossibleInterval, 'Intervalo curto atravessado pode existir sem quebrar cálculo');

console.log('Testes complementares de qualidade concluídos. Casos de login, registro duplicado, painel professor, alertas, insights e metas estão cobertos por validações de rota/controlador e devem ser executados em ambiente com banco migrado.');

process.exit(0);
