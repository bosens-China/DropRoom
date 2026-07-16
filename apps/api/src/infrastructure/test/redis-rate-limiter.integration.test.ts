import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisRateLimiter } from '../rate-limiter.js';

const redisUrl = process.env.DROPROOM_TEST_REDIS_URL;
const describeWithRedis = redisUrl === undefined ? describe.skip : describe;

describeWithRedis('Redis 限流集成', () => {
  const client = createClient({ url: redisUrl });
  const prefix = `droproom-test-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    client.on('error', () => undefined);
    await client.connect();
  });

  afterAll(async () => {
    const keys = await client.keys(`${prefix}:*`);
    if (keys.length > 0) {
      await client.del(keys);
    }
    await client.close();
  });

  it('在多个限流器实例间共享滑动窗口', async () => {
    const first = new RedisRateLimiter(client, prefix);
    const second = new RedisRateLimiter(client, prefix);

    await expect(
      first.consume('join-failed', '198.51.100.7', 2, 60_000),
    ).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
    await expect(
      second.consume('join-failed', '198.51.100.7', 2, 60_000),
    ).resolves.toEqual({ allowed: true, retryAfterMs: 0 });

    const blocked = await first.check('join-failed', '198.51.100.7', 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
});
