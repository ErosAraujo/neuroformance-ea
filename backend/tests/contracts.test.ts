declare const process: any;
declare const require: any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
import { assertRange, normalizeProfile, validateLimitedText, validateRegisterFields } from '../src/validation';
import { assertNotFutureDate, parseDateOnly, parseDateTimeUtc } from '../src/services/timeService';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function throws(fn: () => unknown, message: string) {
  let failed = false;
  try { fn(); } catch { failed = true; }
  assert(failed, message);
}
function notThrows(fn: () => unknown, message: string) {
  try { fn(); } catch (error: any) { throw new Error(`${message}. Erro recebido: ${error.message}`); }
}

// Contratos de instalação limpa.
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
['dev', 'build', 'start', 'prisma:generate', 'prisma:migrate', 'prisma:deploy', 'seed', 'test'].forEach((script) => {
  assert(Boolean(packageJson.scripts?.[script]), `Script obrigatório ausente: ${script}`);
});
assert(!JSON.stringify(packageJson.scripts).includes('"test": "ts-node tests/score.test.ts "test"'), 'Script de teste duplicado/quebrado voltou ao package.json.');

const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20260425090000_init', 'migration.sql');
assert(fs.existsSync(migrationPath), 'Migração inicial obrigatória não encontrada.');
const migration = fs.readFileSync(migrationPath, 'utf8');
assert(migration.includes('SleepRecord_studentId_date_key'), 'Migração precisa preservar 1 registro por data por aluno.');
assert(migration.includes('SleepGoal_one_active_per_student'), 'Migração precisa garantir 1 meta ativa por aluno no PostgreSQL.');

// Contratos de validação forte.
notThrows(() => validateRegisterFields('Aluno Teste', 'aluno@teste.com', '123456', 'student', '1'), 'Cadastro válido de aluno não pode quebrar');
throws(() => validateRegisterFields('A', 'aluno@teste.com', '123456', 'student'), 'Nome curto precisa ser bloqueado');
throws(() => validateRegisterFields('Aluno', 'email-invalido', '123456', 'student'), 'E-mail inválido precisa ser bloqueado');
throws(() => validateRegisterFields('Aluno', 'aluno@teste.com', '123', 'student'), 'Senha curta precisa ser bloqueada');
throws(() => validateRegisterFields('Aluno', 'aluno@teste.com', '123456', 'student'), 'Aluno sem código do professor precisa ser bloqueado');
throws(() => validateRegisterFields('Aluno', 'aluno@teste.com', '123456', 'student', 'abc'), 'Professor inválido precisa ser bloqueado');
assert(normalizeProfile('professor') === 'teacher', 'Perfil professor precisa normalizar para teacher.');
assert(normalizeProfile('student') === 'student', 'Perfil student precisa continuar student.');

assert(assertRange(0, 0, 5, 'Energia') === 0, 'Energia 0 deve ser aceita conforme UX do mobile.');
throws(() => assertRange(-1, 0, 5, 'Energia'), 'Número negativo precisa ser bloqueado.');
throws(() => assertRange(6, 0, 5, 'Energia'), 'Valor fora da escala precisa ser bloqueado.');
throws(() => validateLimitedText('x'.repeat(1001), 'Observação', 1000), 'Texto gigante precisa ser bloqueado.');

notThrows(() => parseDateOnly('2024-04-20'), 'Data real precisa ser aceita');
throws(() => parseDateOnly('2024-02-31'), 'Data impossível precisa ser bloqueada');
throws(() => parseDateTimeUtc('2024-04-20', '99:99'), 'Hora 99:99 precisa ser bloqueada');
const future = new Date();
future.setUTCDate(future.getUTCDate() + 1);
throws(() => assertNotFutureDate(future), 'Data futura precisa ser bloqueada');

console.log('Testes de contratos, instalação, validações e integridade concluídos com sucesso.');

process.exit(0);
