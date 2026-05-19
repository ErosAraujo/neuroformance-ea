# Produção — Backend Sono

## Rodar localmente

```bash
npm install
npm run prisma:generate
npm run typecheck
npm test
npm run build
npm start
```

## Variáveis obrigatórias

Configure `.env` com:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="uma_chave_segura"
CORS_ORIGIN="*"
ADMIN_CREATE_TEACHER_SECRET="segredo_para_criar_professor"
```

Em produção, professor só pode ser criado quando `adminSecret` no body for igual a `ADMIN_CREATE_TEACHER_SECRET`.

## Prisma baseline

### Banco novo

```bash
npm run prisma:deploy
```

### Banco existente com schema já criado

Se o banco já possui tabelas e o Prisma retornar P3005 (`Database schema is not empty`), não resete o banco.

Use:

```bash
npx prisma migrate resolve --applied 20260425090000_init
npm run prisma:deploy
```

### Banco de teste descartável

Somente quando puder apagar tudo:

```bash
npx prisma migrate reset
```

Nunca rode `migrate reset` em produção.

## Healthcheck

```bash
curl http://localhost:3000/health
```

Resposta esperada:

```json
{
  "ok": true,
  "database": "connected",
  "timestamp": "...",
  "uptime": 123.45
}
```
