import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomStore } from '../../room/store/index.js';
import { createTestConfig } from '../../test/config.js';
import { createApp } from '../app.js';

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

describe('文件 HTTP 响应', () => {
  it('只允许安全图片类型以内联方式预览', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    const owner = store.createRoom('发送者');
    const receiver = store.joinRoom(owner.room.code, '接收者');
    const connections = [
      store.subscribe(owner.room.code, owner.memberToken, {
        id: 'owner',
        send: () => undefined,
        close: () => undefined,
      }),
      store.subscribe(owner.room.code, receiver.memberToken, {
        id: 'receiver',
        send: () => undefined,
        close: () => undefined,
      }),
    ];
    const [image] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: '像素.png', size: 4, mimeType: 'image/png' }],
    );
    await store.writeUploadChunk(
      owner.room.code,
      image?.id ?? '',
      owner.memberToken,
      new Blob(['data']).stream(),
      0,
      4,
      sha256('data'),
      image?.fingerprint ?? '',
      new AbortController().signal,
    );

    const response = await app.request(
      `/rooms/${owner.room.code}/files/${image?.id}/content?mode=inline`,
      { headers: { Authorization: `Bearer ${receiver.memberToken}` } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-disposition')).toContain('inline');
    expect(response.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''",
    );
    expect(await response.text()).toBe('data');

    const [html] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: '页面.html', size: 3, mimeType: 'text/html' }],
    );
    await store.writeUploadChunk(
      owner.room.code,
      html?.id ?? '',
      owner.memberToken,
      new Blob(['<x>']).stream(),
      0,
      3,
      sha256('<x>'),
      html?.fingerprint ?? '',
      new AbortController().signal,
    );
    const unsafeResponse = await app.request(
      `/rooms/${owner.room.code}/files/${html?.id}/content?mode=inline`,
      { headers: { Authorization: `Bearer ${receiver.memberToken}` } },
    );
    expect(unsafeResponse.headers.get('content-disposition')).toContain(
      'attachment',
    );
    expect(unsafeResponse.headers.get('x-content-type-options')).toBe(
      'nosniff',
    );

    for (const connection of connections) {
      connection.unsubscribe();
    }
  });
});
