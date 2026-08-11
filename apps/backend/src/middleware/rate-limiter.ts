import { rateLimiter } from 'hono-rate-limiter';

/**
 * General API limiter — 60 requests / 60s / IP.
 * Foundation uses in-memory store; swap to Redis store when multi-instance is needed.
 */
export const apiLimiter = rateLimiter({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  keyGenerator: (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
  handler: (c) => c.json({ message: 'Too many requests. Please try again later.' }, 429),
});
