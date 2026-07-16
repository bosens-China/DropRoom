import { createClient } from 'redis';
import type { ApiConfig } from '../config/env.js';
import type { AppLogger } from './logger.js';

export function createAppRedisClient(config: ApiConfig, logger: AppLogger) {
  const client = createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) =>
        retries >= 5
          ? new Error('Redis 重连次数已达到上限')
          : Math.min(100 * 2 ** retries, 2_000),
    },
  });

  client.on('error', (error) => {
    logger.error({ error }, 'Redis 客户端异常');
  });
  client.on('reconnecting', () => {
    logger.warn('正在重新连接 Redis');
  });
  client.on('ready', () => {
    logger.info('Redis 连接已就绪');
  });

  return client;
}

export type AppRedisClient = ReturnType<typeof createAppRedisClient>;

export async function closeRedisClient(client: AppRedisClient): Promise<void> {
  if (client.isOpen) {
    await client.close();
  }
}
