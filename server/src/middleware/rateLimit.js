import { config } from '../config/index.js';

/**
 * Small fixed-window rate limiter. Keeps the dependency footprint at zero;
 * swap for a shared store (Redis) when the API runs on more than one instance.
 */
export function createRateLimiter({
  windowMs = config.rateLimitWindowMs,
  max = config.rateLimitMax,
  message = 'Too many requests. Please slow down and try again shortly.',
} = {}) {
  const hits = new Map();

  // Drop expired buckets so the map cannot grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  sweep.unref?.();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({
        error: { code: 'rate_limited', message },
      });
      return;
    }
    next();
  };
}
