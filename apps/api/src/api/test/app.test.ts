import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { RateLimiter } from '../../infrastructure/rate-limiter.js';
import { RoomStore } from '../../room/store/index.js';
import { createTestConfig } from '../../test/config.js';
import { roomCookieName } from '../http.js';

const stores: RoomStore[] = [];

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

afterEach(async () => {
  await Promise.all(
    stores.splice(0).map(async (store) => {
      const storageRoot = store.config.storageRoot;
      await store.shutdown();
      await rm(storageRoot, { recursive: true, force: true });
    }),
  );
});

describe('DropRoom API', () => {
  it('Redis 不可用时健康检查返回503', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const unavailableLimiter: RateLimiter = {
      check: async () => ({ allowed: true, retryAfterMs: 0 }),
      consume: async () => ({ allowed: true, retryAfterMs: 0 }),
      redisStatus: () => 'unavailable',
    };
    const app = createApp(store, config, undefined, unavailableLimiter);

    const response = await app.request('/health');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      dependencies: {
        redis: 'unavailable',
      },
    });
  });

  it('提供 OpenAPI 3.1 JSON 和 Swagger UI', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    const openApiResponse = await app.request(config.openApiJsonPath);
    expect(openApiResponse.status).toBe(200);
    const specification = (await openApiResponse.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
      components?: {
        securitySchemes?: Record<string, unknown>;
      };
    };
    expect(specification.openapi).toBe('3.1.0');
    expect(specification.paths).toHaveProperty('/rooms/{code}');
    expect(specification.paths).toHaveProperty(
      '/rooms/{code}/files/{fileId}/content',
    );
    expect(specification.components?.securitySchemes).toHaveProperty('Bearer');
    expect(specification.components?.securitySchemes).toHaveProperty(
      'RoomCookie',
    );

    const swaggerResponse = await app.request(config.swaggerPath);
    expect(swaggerResponse.status).toBe(200);
    expect(swaggerResponse.headers.get('content-type')).toContain('text/html');
    expect(await swaggerResponse.text()).toContain(config.openApiJsonPath);
  });

  it('允许关闭 OpenAPI 和 Swagger', async () => {
    const config = await createTestConfig({ openApiEnabled: false });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    expect((await app.request(config.openApiJsonPath)).status).toBe(404);
    expect((await app.request(config.swaggerPath)).status).toBe(404);
  });

  it('创建、加入并返回房间文字历史', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    const createResponse = await app.request('/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '127.0.0.1',
      },
      body: JSON.stringify({ nickname: '设备一', name: '接口联调室' }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      memberToken: string;
      room: { code: string; name: string };
    };
    expect(created.room.code).toMatch(/^\d{8}$/);
    expect(created.room.name).toBe('接口联调室');
    expect(createResponse.headers.get('set-cookie')).toContain(
      `droproom_${created.room.code}=`,
    );

    const joinResponse = await app.request(`/rooms/${created.room.code}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '127.0.0.2',
      },
      body: JSON.stringify({ nickname: '设备二' }),
    });
    expect(joinResponse.status).toBe(200);
    const joined = (await joinResponse.json()) as {
      memberToken: string;
    };

    const messageResponse = await app.request(
      `/rooms/${created.room.code}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${joined.memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: '需要传输的文字' }),
      },
    );
    expect(messageResponse.status).toBe(201);

    const snapshotResponse = await app.request(`/rooms/${created.room.code}`, {
      headers: {
        Authorization: `Bearer ${created.memberToken}`,
      },
    });
    expect(snapshotResponse.status).toBe(200);
    const snapshot = (await snapshotResponse.json()) as {
      items: Array<{ type: string; content?: string }>;
    };
    expect(snapshot.items).toContainEqual(
      expect.objectContaining({
        type: 'text',
        content: '需要传输的文字',
      }),
    );
  });

  it('通过共享限流器限制同一 IP 的失败加入尝试', async () => {
    const config = await createTestConfig({
      maxFailedJoinsPerMinute: 2,
    });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);
    const request = () =>
      app.request('/rooms/00000000/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.5',
        },
        body: JSON.stringify({ nickname: '成员' }),
      });

    expect((await request()).status).toBe(404);
    expect((await request()).status).toBe(404);
    const blocked = await request();
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({
      error: {
        code: 'JOIN_RATE_LIMITED',
        retryAfterMs: expect.any(Number),
      },
    });
  });

  it('通过 SSE 向成员发送房间快照', async () => {
    const config = await createTestConfig({ sseHeartbeatMs: 50 });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);
    const owner = store.createRoom('房主');

    const response = await app.request(`/rooms/${owner.room.code}/events`, {
      headers: {
        Cookie: `${roomCookieName(owner.room.code)}=${owner.memberToken}`,
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const firstChunk = await reader?.read();
    const content = new TextDecoder().decode(firstChunk?.value);
    expect(content).toContain('event: room.snapshot');
    expect(content).toContain(owner.room.code);
    await reader?.cancel();
  });

  it('完成文件预留、上传和原生 HTTP 下载', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    const owner = store.createRoom('发送者');
    const receiver = store.joinRoom(owner.room.code, '接收者');
    const ownerConnection = store.subscribe(
      owner.room.code,
      owner.memberToken,
      {
        id: 'owner',
        send: () => undefined,
        close: () => undefined,
      },
    );
    const receiverConnection = store.subscribe(
      owner.room.code,
      receiver.memberToken,
      {
        id: 'receiver',
        send: () => undefined,
        close: () => undefined,
      },
    );
    const fingerprint = 'a'.repeat(64);

    const reserveResponse = await app.request(
      `/rooms/${owner.room.code}/uploads`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${owner.memberToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [
            {
              name: 'payload.txt',
              size: 7,
              mimeType: 'text/plain',
              fingerprint,
            },
          ],
        }),
      },
    );
    expect(reserveResponse.status).toBe(201);
    const reservation = (await reserveResponse.json()) as {
      files: Array<{ id: string }>;
    };
    const fileId = reservation.files[0]?.id;
    expect(fileId).toBeDefined();

    const uploadResponse = await app.request(
      `/rooms/${owner.room.code}/files/${fileId}/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${owner.memberToken}`,
          'Content-Length': '7',
          'Content-Type': 'application/octet-stream',
          'Upload-Offset': '0',
          'X-Chunk-Sha256': sha256('payload'),
          'X-File-Fingerprint': fingerprint,
        },
        body: 'payload',
      },
    );
    expect(uploadResponse.status).toBe(200);

    const downloadResponse = await app.request(
      `/rooms/${owner.room.code}/files/${fileId}/content?mode=attachment`,
      { headers: { Authorization: `Bearer ${receiver.memberToken}` } },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get('content-length')).toBe('7');
    expect(downloadResponse.headers.get('content-disposition')).toContain(
      'attachment',
    );
    expect(await downloadResponse.text()).toBe('payload');

    ownerConnection.unsubscribe();
    receiverConnection.unsubscribe();
  });

  it('拒绝缺少成员凭证和超过长度的文字', async () => {
    const config = await createTestConfig({ maxTextLength: 5 });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);
    const owner = store.createRoom('房主');

    const unauthorized = await app.request(
      `/rooms/${owner.room.code}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      },
    );
    expect(unauthorized.status).toBe(401);

    const tooLong = await app.request(`/rooms/${owner.room.code}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${owner.memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '123456' }),
    });
    expect(tooLong.status).toBe(413);
  });
});
