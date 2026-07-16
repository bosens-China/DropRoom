import { Writable } from 'node:stream';
import { rm } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../api/app.js';
import { RoomStore } from '../../room/store/index.js';
import { createTestConfig } from '../../test/config.js';
import { createLogger } from '../logger.js';

describe('Pino 接口日志', () => {
  it('记录请求 ID、状态和耗时，并脱敏成员凭证', async () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const config = await createTestConfig({ logLevel: 'info' });
    const logger = createLogger(config, destination);
    const store = new RoomStore(config);
    await store.initialize();
    const app = createApp(store, config, logger);

    const response = await app.request('/health', {
      headers: {
        'X-Request-Id': 'request-123',
      },
    });
    logger.info({ memberToken: 'secret-token' }, '脱敏测试');

    expect(response.headers.get('x-request-id')).toBe('request-123');
    expect(output).toContain('"requestId":"request-123"');
    expect(output).toContain('"status":200');
    expect(output).toContain('"responseTimeMs":');
    expect(output).not.toContain('secret-token');
    expect(output).toContain('[REDACTED]');

    await store.shutdown();
    await rm(config.storageRoot, { recursive: true, force: true });
  });
});
