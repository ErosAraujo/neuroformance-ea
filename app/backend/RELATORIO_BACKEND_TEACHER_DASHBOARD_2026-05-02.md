# Relatório Backend — Dashboard Consolidado do Professor — 2026-05-02

## Escopo executado

Alteração feita somente no backend, mantendo mobile-app e teacher-app intactos nesta etapa.

Objetivo atendido: criar uma fonte oficial consolidada para o painel do professor, centralizando cálculos de recuperação, risco, adesão, meta de sono e alertas.

## Arquivos modificados/criados

### Criados

- `backend/src/services/teacherDashboardService.ts`
- `backend/src/controllers/TeacherController.ts`
- `backend/src/routes/teacherRoutes.ts`
- `backend/tests/teacherDashboard.test.ts`
- `backend/RELATORIO_BACKEND_TEACHER_DASHBOARD_2026-05-02.md`

### Modificados

- `backend/src/index.ts`
- `backend/src/middleware/authMiddleware.ts`

## Funções puras criadas

Todas ficaram em `src/services/teacherDashboardService.ts`:

- `isValidNumber(value)`
- `safeScore(value)`
- `safeDate(value)`
- `normalizeLocalDate(date)`
- `isToday(date)`
- `getLastValidRecords(records, limit)`
- `getRecordsLastDays(records, days)`
- `averageScores(records)`
- `averageSleepHours(records)`
- `getLatestRecord(records)`
- `calculateReadinessScore(student)`
- `calculateRiskStudent(student)`
- `calculateLowAdherence(student)`
- `calculateFatigueRisk(student)`
- `calculateGoalNotMet(student)`
- `generateTeacherAlerts(student)`
- `buildTeacherDashboardSummary(students)`

Também foram criadas funções auxiliares seguras para serialização e mapeamento:

- `mapSleepRecordForTeacher(record)`
- `mapSleepGoal(goal)`
- `fatigueRiskLevel(value)`

## Rotas criadas

### `GET /api/teacher/dashboard-summary`

Rota protegida por autenticação. Exige perfil `teacher` ou `admin`.

Retorna:

- total de alunos;
- alunos que registraram hoje;
- alunos em risco;
- baixa adesão;
- adesão crítica;
- risco de fadiga;
- meta de sono não cumprida;
- alunos com alertas;
- total de alertas ativos;
- top 3 piores recuperações;
- lista consolidada de alunos com registros, meta ativa, médias, prontidão, fadiga, adesão e alertas.

### `GET /api/teacher/students/:studentId/sleep-records`

Rota protegida por autenticação de professor/admin.

Retorna registros completos do aluno com campos padronizados para o professor.

### `GET /api/teacher/students/:studentId/sleep-records/:recordId`

Rota protegida por autenticação de professor/admin.

Retorna um registro completo específico do aluno.

## Regras oficiais implementadas

### Registrou hoje

Conta aluno que possui registro de sono na data local atual do app.

### Aluno em risco

Ativa quando:

- média dos últimos 3 scores válidos é menor que 55; ou
- último score válido é menor que 40.

### Baixa adesão

Ativa quando o aluno possui menos de 3 registros nos últimos 7 dias.

### Crítico de adesão

Ativa quando o aluno possui 0 registros nos últimos 7 dias.

### Top 3 piores recuperações

Usa média dos últimos 3 scores válidos, ordenando do menor para o maior. Aluno sem score válido é excluído.

### Risco de fadiga

Implementado com a fórmula oficial:

- `risco1 = 100 - média dos últimos 3 scores válidos`
- `risco2 = min((queda / 20) * 100, 100)`
- `risco3 = ((5 - energia) / 5) * 100`
- `riscoFinal = risco1 * 0.50 + risco2 * 0.30 + risco3 * 0.20`

Proteções aplicadas:

- se não houver 3 registros válidos, retorna `insuficiente`;
- se energia estiver ausente no registro mais recente válido, retorna `insuficiente`;
- energia ausente não vira risco máximo;
- score ausente não vira 0.

### Meta de sono não cumprida

Só calcula se houver meta ativa.

- média real de horas dormidas dos últimos 7 dias abaixo da meta ativa = meta não cumprida;
- média real mais de 1h abaixo da meta ativa = déficit severo;
- aluno sem meta ativa não entra como meta não cumprida.

### Prontidão

Usa média dos últimos 3 scores válidos. Sem dados válidos retorna `null`.

## Alertas implementados

Todos são gerados por `generateTeacherAlerts(student)` no formato:

```ts
{
  id,
  studentId,
  studentName,
  type,
  title,
  message,
  severity,
  actionSuggestion,
  createdAt,
  active,
  source: 'backend'
}
```

Alertas criados:

1. `SCORE_CRITICO_ULTIMA_NOITE`
2. `DUAS_NOITES_RUINS`
3. `MEDIA_SEMANAL_BAIXA`
4. `SEM_ENERGIA_3_NOITES`
5. `RISCO_FADIGA_ELEVADO`
6. `PRONTIDAO_BAIXA_HOJE`
7. `DEFICIT_SEVERO_SONO`
8. `SEM_REGISTRAR_3_DIAS`
9. `BAIXA_ADESAO_SEMANAL`
10. `NECESSITA_CONTATO_PROFESSOR`

## Rotas antigas preservadas

Nada foi removido.

Mantidas:

- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/students`
- `GET /api/students/:id`
- `GET /api/alerts`
- `POST /api/sleep-records`
- `PUT /api/sleep-records/:id`
- `GET /api/sleep-records/recovery-summary`
- `GET /api/sleep-records/weekly-summary`
- `GET /api/sleep-goals/active`
- `GET /api/sleep-goals/student/:id/active`
- `POST /api/sleep-goals/student/:id`

## Testes executados

### Comandos executados com sucesso

```bash
npm install --ignore-scripts
JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' npm run typecheck
JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' npx tsc
JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' node -r ts-node/register tests/score.test.ts
JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' node -r ts-node/register tests/contracts.test.ts
JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' node -r ts-node/register tests/quality.test.ts
JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' node -r ts-node/register tests/teacherDashboard.test.ts
PORT=3010 JWT_SECRET=test DATABASE_URL='postgresql://user:pass@localhost:5432/db?schema=public' npm run dev
curl http://localhost:3010/api/teacher/dashboard-summary
```

### Resultado dos testes

- TypeScript passou em `tsc --noEmit`.
- Compilação TypeScript passou em `npx tsc`.
- Testes existentes passaram.
- Novo teste de dashboard consolidado passou.
- Servidor iniciou em modo dev.
- A rota `/api/teacher/dashboard-summary` respondeu `401 Token não fornecido` sem token, confirmando que a rota está montada e protegida pelo middleware.

## O que não foi possível testar 100% neste ambiente

`npm run build` executa `npx prisma generate` antes de `tsc`.

Neste ambiente, o Prisma tentou baixar binários em `binaries.prisma.sh`, mas a rede externa falhou com `getaddrinfo EAI_AGAIN`. Por isso, o comando completo `npm run build` não pôde finalizar aqui.

A parte de TypeScript que viria após o Prisma foi validada separadamente com `npx tsc` e passou.

Também não foi possível testar a rota consolidada com dados reais do banco porque o ZIP não veio com `.env` real nem banco PostgreSQL acessível. A lógica de cálculo foi testada por função pura com casos críticos.

## Casos críticos validados no novo teste

- aluno sem registro não quebra;
- aluno com score `null` não tem score convertido para 0;
- aluno com score alto não vira risco;
- aluno sem meta ativa não entra como meta não cumprida;
- energia ausente retorna fadiga `insuficiente`, não risco máximo;
- meta ativa abaixo do necessário marca meta não cumprida;
- déficit maior que 1h marca déficit severo;
- top 3 piores recuperações ignora aluno sem score válido;
- alertas oficiais são gerados em formato padronizado;
- registro de hoje usa data local do app.

## O que o frontend deverá alterar depois

No `teacher-app`, substituir a montagem atual baseada em várias chamadas:

- `/dashboard`
- `/students`
- `/alerts`
- `/students/:id`
- `/sleep-goals/student/:id/active`

por uma chamada principal:

```ts
GET /api/teacher/dashboard-summary
```

Uso recomendado:

- cards superiores do painel devem vir dos campos totais do resumo;
- lista de alunos deve vir de `summary.students`;
- alertas devem vir de `student.alerts` ou do total `summary.totalActiveAlerts`;
- top 3 piores recuperações deve usar `summary.topWorstRecoveries`;
- detalhes do aluno podem usar `summary.students[n]` como base e chamar a rota de registros completos somente quando precisar abrir histórico detalhado.

## Checklist final

- [x] Projeto lido e interligações principais identificadas.
- [x] Backend alterado sem mexer no mobile-app.
- [x] Frontend preservado nesta etapa.
- [x] Rotas antigas preservadas.
- [x] Serviço puro de cálculo criado.
- [x] Endpoint consolidado do professor criado.
- [x] Rotas de registros completos do professor criadas.
- [x] Regras oficiais implementadas.
- [x] 10 alertas oficiais implementados.
- [x] Proteções para dados ausentes implementadas.
- [x] Typecheck aprovado.
- [x] Compilação TypeScript aprovada.
- [x] Testes de cálculo existentes aprovados.
- [x] Teste novo do dashboard consolidado aprovado.
- [x] Servidor dev iniciou.
- [x] Rota nova confirmou proteção por autenticação.
- [x] Pendência externa registrada: `prisma generate` depende de binários Prisma que não puderam ser baixados neste ambiente.
