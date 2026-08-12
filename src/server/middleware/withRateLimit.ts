import { AppError } from '@/server/lib/http';
import type { Middleware } from './compose';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export const withRateLimit: Middleware = (handler) => async (req, ctx) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || entry.resetAt < now) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
    if (entry.count > MAX_REQUESTS) {
      throw new AppError('RATE_LIMITED', 'Too many requests', 429);
    }
  }
  return handler(req, ctx);
};
