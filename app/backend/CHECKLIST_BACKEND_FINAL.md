# Checklist Backend Final — Sono

## Alterações concluídas

- [x] Criado padrão oficial `rollingLast7Days` em `timeService.ts`.
- [x] Criado `getTodayRange` em `timeService.ts`.
- [x] Mantida compatibilidade de `getClosedWeekRange`, agora delegando para últimos 7 dias corridos.
- [x] `/api/sleep-records/weekly-summary` ajustado para últimos 7 dias corridos.
- [x] `/api/sleep-records/recovery-summary` preservado com regra de últimas 3 noites para prontidão.
- [x] Refresh de alertas após registro ajustado para últimos 7 dias corridos.
- [x] `/api/dashboard` ajustado para hoje + últimos 7 dias + 7 dias anteriores.
- [x] Dashboard preserva campos antigos e adiciona `last7DaysAverage`, `last7DaysAdherence`, `initialTrackingStudents`, `studentsWithoutData`, `studentsAtRisk`.
- [x] `/api/students` ajustado para não marcar aluno novo como prioridade alta sem histórico suficiente.
- [x] `/api/students/:id` ajustado para métricas de últimos 7 dias corridos.
- [x] Recomendações do detalhe individual ajustadas para não pedir reforço de registro quando o aluno registrou hoje com score excelente.
- [x] `alertService` revisado para não gerar baixa adesão injusta para aluno novo.
- [x] Alerta `media_abaixo_55` agora exige pelo menos 2 registros.
- [x] Alertas de irregularidade e poucas horas exigem pelo menos 3 registros.
- [x] `/api/auth/me` protegido por JWT e com retorno direto dos dados do usuário, preservando também `user` para compatibilidade.
- [x] Cadastro público de professor protegido em produção por `ADMIN_CREATE_TEACHER_SECRET`.
- [x] Cadastro de aluno sem `teacherCode` bloqueado com mensagem oficial.
- [x] `/health` agora valida conexão com banco.
- [x] Criado `/health/db`.
- [x] Criado `BACKEND_API_CONTRACT.md`.
- [x] Atualizado `README_PRODUCAO.md` com baseline Prisma P3005.
- [x] `.env.example` atualizado com `ADMIN_CREATE_TEACHER_SECRET`.

## Validação

- [ ] `npm install` — não concluído neste ambiente porque as dependências não estavam instaladas no ZIP e o comando ficou sem retorno até o timeout.
- [ ] `npm run typecheck` — não executado porque `node_modules` não estava disponível.
- [ ] `npm test` — não executado porque `node_modules` não estava disponível.
- [ ] `npm run build` — não executado porque `node_modules` não estava disponível.

## Parecer honesto

O backend foi ajustado conforme o escopo solicitado, mas eu não vou marcar como “validado em build” sem `typecheck`, `test` e `build` passarem. Rode os comandos abaixo no seu ambiente local com internet/dependências instaladas.
