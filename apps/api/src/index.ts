import { serve } from '@hono/node-server';
import { createApp } from './api/app.js';
import { loadApiConfig } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';
import { RedisRateLimiter } from './infrastructure/rate-limiter.js';
import {
  closeRedisClient,
  createAppRedisClient,
} from './infrastructure/redis.js';
import { RoomStore } from './room/store/index.js';

const config = loadApiConfig();
const logger = createLogger(config);
const redisClient = createAppRedisClient(config, logger);
await redisClient.connect();
const rateLimiter = new RedisRateLimiter(redisClient, config.redisKeyPrefix);
const store = new RoomStore(config);
await store.initialize();
store.startMaintenance();

const app = createApp(store, config, logger, rateLimiter);

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    logger.info(
      {
        url: `http://localhost:${info.port}`,
        storageRoot: config.storageRoot,
        swaggerUrl: config.openApiEnabled
          ? `http://localhost:${info.port}${config.swaggerPath}`
          : undefined,
      },
      '服务已启动',
    );
  },
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal }, '服务正在停止');
  server.close();
  try {
    await Promise.all([store.shutdown(), closeRedisClient(redisClient)]);
    logger.info('服务已停止');
  } catch (error: unknown) {
    logger.error({ error }, '停止服务时发生错误');
    process.exitCode = 1;
  } finally {
    logger.flush();
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
