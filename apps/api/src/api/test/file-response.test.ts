import { createHash } from 'node:crypto';
import { rm, stat } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { DISSOLVED_DOWNLOAD_RETENTION_MS } from '../../room/store/core.js';
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
  it('只允许安全图片和纯文本类型以内联方式预览', async () => {
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

    const [text] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [
        {
          name: '说明.txt',
          size: 4,
          mimeType: 'text/plain; charset=utf-8',
        },
      ],
    );
    await store.writeUploadChunk(
      owner.room.code,
      text?.id ?? '',
      owner.memberToken,
      new Blob(['text']).stream(),
      0,
      4,
      sha256('text'),
      text?.fingerprint ?? '',
      new AbortController().signal,
    );
    const textResponse = await app.request(
      `/rooms/${owner.room.code}/files/${text?.id}/content?mode=inline`,
      { headers: { Authorization: `Bearer ${receiver.memberToken}` } },
    );
    expect(textResponse.headers.get('content-disposition')).toContain('inline');
    expect(await textResponse.text()).toBe('text');

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
    expect(await unsafeResponse.text()).toBe('<x>');

    const downloadedFile = await store.getDownload(
      owner.room.code,
      image?.id ?? '',
      receiver.memberToken,
    );
    await store.dissolveRoom(owner.room.code, owner.memberToken);
    await expect(stat(downloadedFile.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });

    for (const connection of connections) {
      connection.unsubscribe();
    }
  });

  it('解散时只保留正在下载的文件，并在30分钟后清理', async () => {
    let currentTime = 1_000;
    const config = await createTestConfig();
    const store = new RoomStore(config, () => currentTime);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    const owner = store.createRoom('房主');
    const receiver = store.joinRoom(owner.room.code, '接收者');
    const files = store.reserveUploadBatch(owner.room.code, owner.memberToken, [
      { name: '下载中.txt', size: 5, mimeType: 'text/plain' },
      { name: '未下载.txt', size: 4, mimeType: 'text/plain' },
    ]);
    const [activeFile, idleFile] = files;
    await store.writeUploadChunk(
      owner.room.code,
      activeFile?.id ?? '',
      owner.memberToken,
      new Blob(['hello']).stream(),
      0,
      5,
      sha256('hello'),
      activeFile?.fingerprint ?? '',
      new AbortController().signal,
    );
    await store.writeUploadChunk(
      owner.room.code,
      idleFile?.id ?? '',
      owner.memberToken,
      new Blob(['idle']).stream(),
      0,
      4,
      sha256('idle'),
      idleFile?.fingerprint ?? '',
      new AbortController().signal,
    );
    const activeDownload = await store.getDownload(
      owner.room.code,
      activeFile?.id ?? '',
      receiver.memberToken,
    );
    const idleDownload = await store.getDownload(
      owner.room.code,
      idleFile?.id ?? '',
      receiver.memberToken,
    );

    const response = await app.request(
      `/rooms/${owner.room.code}/files/${activeFile?.id}/content`,
      { headers: { Authorization: `Bearer ${receiver.memberToken}` } },
    );
    await store.dissolveRoom(owner.room.code, owner.memberToken);

    expect((await stat(activeDownload.path)).isFile()).toBe(true);
    await expect(stat(idleDownload.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await response.text()).toBe('hello');

    currentTime += DISSOLVED_DOWNLOAD_RETENTION_MS - 1;
    await store.runMaintenance();
    expect((await stat(activeDownload.path)).isFile()).toBe(true);

    currentTime += 2;
    await store.runMaintenance();
    await expect(stat(activeDownload.path)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
