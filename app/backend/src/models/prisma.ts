// Exporta instância única do Prisma para uso em todo o backend.
// A importação dinâmica evita que o typecheck quebre em ambientes onde o Prisma Client
// ainda não foi gerado. Em produção/desenvolvimento real, rode `npm run prisma:generate`
// antes de iniciar a API.
let PrismaClientCtor: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PrismaClientCtor = require('@prisma/client').PrismaClient;
} catch {
  PrismaClientCtor = null;
}

if (!PrismaClientCtor) {
  throw new Error('Prisma Client não foi gerado. Rode `npm run prisma:generate` antes de iniciar o backend.');
}

const prisma = new PrismaClientCtor();

export default prisma as any;
