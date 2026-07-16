import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../shared/errors.js';

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

export type RedisStatus = 'ready' | 'unavailable' | 'not_configured';

export interface RateLimiter {
  check(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult>;
  consume(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult>;
  redisStatus(): RedisStatus;
}

type RedisEvalClient = {
  readonly isReady: boolean;
  eval(
    script: string,
    options: {
      keys: string[];
      arguments: string[];
    },
  ): Promise<unknown>;
};

const SLIDING_WINDOW_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local action = ARGV[3]
local member = ARGV[4]
local cutoff = now - window

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', cutoff)
local count = redis.call('ZCARD', KEYS[1])

if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retryAfter = math.max(1, window - (now - tonumber(oldest[2])))
  redis.call('PEXPIRE', KEYS[1], window)
  return {0, retryAfter}
end

if action == 'consume' then
  redis.call('ZADD', KEYS[1], now, member)
  redis.call('PEXPIRE', KEYS[1], window)
end

return {1, 0}
`;

function parseRateLimitResult(value: unknown): RateLimitResult {
  if (!Array.isArray(value) || value.length < 2) {
    throw new ApiError(503, 'REDIS_INVALID_RESPONSE', '限流服务响应异常');
  }

  const allowed = Number(value[0]);
  const retryAfterMs = Number(value[1]);
  if (
    (allowed !== 0 && allowed !== 1) ||
    !Number.isSafeInteger(retryAfterMs) ||
    retryAfterMs < 0
  ) {
    throw new ApiError(503, 'REDIS_INVALID_RESPONSE', '限流服务响应异常');
  }

  return {
    allowed: allowed === 1,
    retryAfterMs,
  };
}

export class RedisRateLimiter implements RateLimiter {
  private readonly client: RedisEvalClient;
  private readonly keyPrefix: string;

  constructor(client: RedisEvalClient, keyPrefix: string) {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  check(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    return this.execute(scope, identity, limit, windowMs, 'check');
  }

  consume(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    return this.execute(scope, identity, limit, windowMs, 'consume');
  }

  redisStatus(): RedisStatus {
    return this.client.isReady ? 'ready' : 'unavailable';
  }

  private async execute(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
    action: 'check' | 'consume',
  ): Promise<RateLimitResult> {
    try {
      const response = await this.client.eval(SLIDING_WINDOW_SCRIPT, {
        keys: [this.key(scope, identity)],
        arguments: [
          windowMs.toString(),
          limit.toString(),
          action,
          randomUUID(),
        ],
      });
      return parseRateLimitResult(response);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(503, 'REDIS_UNAVAILABLE', '限流服务暂时不可用');
    }
  }

  private key(scope: string, identity: string): string {
    const identityHash = createHash('sha256').update(identity).digest('hex');
    return `${this.keyPrefix}:rate:${scope}:${identityHash}`;
  }
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly attempts = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async check(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    return this.evaluate(scope, identity, limit, windowMs, false);
  }

  async consume(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    return this.evaluate(scope, identity, limit, windowMs, true);
  }

  redisStatus(): RedisStatus {
    return 'not_configured';
  }

  private evaluate(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
    consume: boolean,
  ): RateLimitResult {
    const currentTime = this.now();
    const key = `${scope}:${identity}`;
    const attempts = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > currentTime - windowMs,
    );

    if (attempts.length >= limit) {
      this.attempts.set(key, attempts);
      return {
        allowed: false,
        retryAfterMs: Math.max(1, attempts[0] + windowMs - currentTime),
      };
    }

    if (consume) {
      attempts.push(currentTime);
    }
    if (attempts.length === 0) {
      this.attempts.delete(key);
    } else {
      this.attempts.set(key, attempts);
    }
    return { allowed: true, retryAfterMs: 0 };
  }
}
