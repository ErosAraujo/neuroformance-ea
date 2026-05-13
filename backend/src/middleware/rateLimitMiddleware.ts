import { NextFunction, Request, Response } from 'express';

type RateBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  key: (req: Request) => string;
  message: string;
};

const buckets = new Map<string, RateBucket>();

function isRateLimitDisabled() {
  return process.env.DISABLE_RATE_LIMIT === 'true' || process.env.RATE_LIMIT_DISABLED === 'true';
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getRequestIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '').split(',')[0];
  return (firstForwardedIp || req.ip || req.socket.remoteAddress || 'unknown').trim();
}

function normalizeLoginIdentifier(req: Request): string {
  const raw = typeof req.body?.email === 'string' ? req.body.email : typeof req.body?.login === 'string' ? req.body.login : '';
  return raw.trim().toLowerCase() || 'sem-login';
}

function loginBucketKey(req: Request): string {
  return `login:${getRequestIp(req)}:${normalizeLoginIdentifier(req)}`;
}

function consumeRateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isRateLimitDisabled()) return next();

    const now = Date.now();
    const key = `${options.name}:${options.key(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: options.message });
    }

    return next();
  };
}

const isProduction = process.env.NODE_ENV === 'production';

export const globalRateLimit = consumeRateLimit({
  name: 'global',
  windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: envNumber('RATE_LIMIT_MAX', isProduction ? 900 : 10000),
  key: getRequestIp,
  message: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
});

export const loginRateLimit = consumeRateLimit({
  name: 'auth-login',
  windowMs: envNumber('LOGIN_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000),
  max: envNumber('LOGIN_RATE_LIMIT_MAX', isProduction ? 30 : 500),
  key: loginBucketKey,
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
});

export function resetLoginRateLimit(req: Request) {
  buckets.delete(`auth-login:${loginBucketKey(req)}`);
}

export function clearRateLimitMemoryForTests() {
  buckets.clear();
}
