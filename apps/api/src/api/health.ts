import type { RateLimiter } from '../infrastructure/rate-limiter.js';

export function getHealthResponse(rateLimiter: RateLimiter) {
  const redisStatus = rateLimiter.redisStatus();
  return {
    body: {
      ok: redisStatus !== 'unavailable',
      service: 'droproom-api' as const,
      now: new Date().toISOString(),
      dependencies: {
        redis: redisStatus,
      },
    },
    status: redisStatus === 'unavailable' ? (503 as const) : (200 as const),
  };
}
