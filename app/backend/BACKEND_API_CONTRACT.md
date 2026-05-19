# Contrato Oficial da API — Backend Sono

## GET /health
Retorna status do backend e conexão com banco.

Sucesso:
```json
{
  "ok": true,
  "database": "connected",
  "timestamp": "2026-04-28T00:00:00.000Z",
  "uptime": 123.45
}
```

Falha de banco: status 500.

## POST /api/auth/register

### Professor
```json
{
  "name": "Professor Teste",
  "email": "professor@teste.com",
  "password": "123456",
  "profile": "teacher",
  "adminSecret": "segredo_configurado_no_env"
}
```

Em produção, o cadastro de professor exige `adminSecret` igual a `ADMIN_CREATE_TEACHER_SECRET`.

### Aluno
```json
{
  "name": "Aluno Teste",
  "email": "aluno@teste.com",
  "password": "123456",
  "profile": "student",
  "teacherCode": "1"
}
```

Aluno sem `teacherCode` é bloqueado.

## POST /api/auth/login
```json
{
  "email": "aluno@teste.com",
  "password": "123456"
}
```

## GET /api/auth/me
Protegida por JWT.

Aluno:
```json
{
  "id": 1,
  "name": "Aluno Teste",
  "email": "aluno@teste.com",
  "profile": "student"
}
```

Professor:
```json
{
  "id": 1,
  "name": "Professor Teste",
  "email": "professor@teste.com",
  "profile": "teacher",
  "teacherCode": "1"
}
```

## POST /api/sleep-records
Protegida por JWT de aluno.

Contrato oficial:
```json
{
  "date": "YYYY-MM-DD",
  "sleepTime": "HH:mm",
  "wakeTime": "HH:mm",
  "perceivedQuality": 1,
  "awakenings": 0,
  "morningState": 1,
  "energy": 0,
  "mood": 1,
  "notes": "texto opcional"
}
```

Faixas:
- `perceivedQuality`: 1 a 5
- `awakenings`: 0 a 20
- `morningState`: 1 a 5
- `energy`: 0 a 5
- `mood`: opcional, 1 a 5

## GET /api/sleep-records/recovery-summary
Usa as últimas 3 noites para `readinessScore`.

## GET /api/sleep-records/weekly-summary
Usa últimos 7 dias corridos, incluindo hoje (`rollingLast7Days`).

## GET /api/dashboard
Protegida por JWT de professor. Usa hoje para presença diária, últimos 7 dias corridos para médias/adesão e os 7 dias anteriores para tendência.

## GET /api/students
Protegida por JWT de professor. Lista alunos ativos do professor com métricas dos últimos 7 dias corridos.

## GET /api/students/:id
Protegida por JWT de professor. Retorna detalhe individual do aluno com métricas, alertas, observações e registros recentes.
