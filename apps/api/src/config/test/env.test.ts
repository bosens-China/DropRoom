import { describe, expect, it } from 'vitest';
import { DEFAULT_API_CONFIG, loadApiConfig } from '../env.js';

describe('API 环境配置', () => {
  it('本地开发不填写环境变量时使用合理默认值', () => {
    const config = loadApiConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(DEFAULT_API_CONFIG.port);
    expect(config.redisUrl).toBe('redis://127.0.0.1:46379');
    expect(config.corsOrigins).toEqual(DEFAULT_API_CONFIG.corsOrigins);
    expect(config.openApiEnabled).toBe(true);
    expect(config.swaggerPath).toBe('/docs');
  });

  it('生产环境要求填写前端来源和 Redis 地址', () => {
    const config = loadApiConfig({
      NODE_ENV: 'production',
      DROPROOM_CORS_ORIGINS:
        'https://drop.example.com, https://admin.example.com',
      DROPROOM_REDIS_URL: 'rediss://redis.example.com:6380',
    });

    expect(config.corsOrigins).toEqual([
      'https://drop.example.com',
      'https://admin.example.com',
    ]);
    expect(config.redisUrl).toBe('rediss://redis.example.com:6380');
    expect(config.port).toBe(DEFAULT_API_CONFIG.port);
    expect(config.logLevel).toBe('info');
  });

  it('拒绝缺少生产前端来源或不合法的配置', () => {
    expect(() => loadApiConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() =>
      loadApiConfig({
        NODE_ENV: 'production',
        DROPROOM_CORS_ORIGINS: 'https://drop.example.com',
      }),
    ).toThrow();
    expect(() => loadApiConfig({ DROPROOM_API_PORT: 'not-a-port' })).toThrow();
    expect(() =>
      loadApiConfig({ DROPROOM_REDIS_URL: 'http://localhost:46379' }),
    ).toThrow();
    expect(() =>
      loadApiConfig({
        DROPROOM_OPENAPI_JSON_PATH: '/docs',
        DROPROOM_SWAGGER_PATH: '/docs',
      }),
    ).toThrow();
    expect(() =>
      loadApiConfig({ DROPROOM_CORS_ORIGINS: 'not-a-url' }),
    ).toThrow();
  });

  it('允许通过环境变量关闭接口文档', () => {
    expect(
      loadApiConfig({ DROPROOM_OPENAPI_ENABLED: 'false' }).openApiEnabled,
    ).toBe(false);
  });
});
