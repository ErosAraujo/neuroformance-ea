import { PrismaClient } from '@prisma/client';

// Exporta instância única do Prisma para uso em todo o backend.
const prisma = new PrismaClient();

export default prisma;