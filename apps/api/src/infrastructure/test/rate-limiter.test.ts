import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter, RedisRateLimiter } from '../rate-limiter.js';

describe('共享限流器', () => {
  it('按滑动窗口限制请求并返回剩余等待时间', async () => {
    let currentTime = 1_000;
    const limiter = new InMemoryRateLimiter(() => currentTime);

    await expect(
      limiter.consume('room-create', '127.0.0.1', 2, 100),
    ).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
    currentTime += 10;
    await expect(
      limiter.consume('room-create', '127.0.0.1', 2, 100),
    ).resolves.toEqual({ allowed: true, retryAfterMs: 0 });

    currentTime += 10;
    await expect(
      limiter.consume('room-create', '127.0.0.1', 2, 100),
    ).resolves.toEqual({ allowed: false, retryAfterMs: 80 });

    currentTime += 81;
    await expect(
      limiter.check('room-create', '127.0.0.1', 2, 100),
    ).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it('Redis 限流键不暴露原始身份并校验脚本响应', async () => {
    let receivedKey = '';
    const client = {
      isReady: true,
      eval: async (
        _script: string,
        options: { keys: string[]; arguments: string[] },
      ): Promise<unknown> => {
        receivedKey = options.keys[0] ?? '';
        return [0, 1_234];
      },
    };
    const limiter = new RedisRateLimiter(client, 'droproom-test');

    await expect(
      limiter.consume('join-failed', '203.0.113.10', 10, 60_000),
    ).resolves.toEqual({ allowed: false, retryAfterMs: 1_234 });
    expect(receivedKey).toMatch(
      /^droproom-test:rate:join-failed:[a-f0-9]{64}$/,
    );
    expect(receivedKey).not.toContain('203.0.113.10');
    expect(limiter.redisStatus()).toBe('ready');
  });
});
