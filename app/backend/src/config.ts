const requiredJwtSecret = process.env.JWT_SECRET;

if (!requiredJwtSecret) {
  throw new Error('JWT_SECRET obrigatório. Configure a variável no .env antes de iniciar o backend.');
}

export const JWT_SECRET: string = requiredJwtSecret;
export const corsOrigin = process.env.CORS_ORIGIN || '*';
