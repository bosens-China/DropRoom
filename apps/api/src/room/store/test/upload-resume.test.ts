import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestConfig } from '../../../test/config.js';
import { RoomStore } from '../index.js';

const stores: RoomStore[] = [];

afterEach(async () => {
  await Promise.all(
    stores.splice(0).map(async (store) => {
      const storageRoot = store.config.storageRoot;
      await store.shutdown();
      await rm(storageRoot, { recursive: true, force: true });
    }),
  );
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('断点续传', () => {
  it('按服务端偏移继续上传未完成文件', async () => {
    const config = await createTestConfig({ uploadChunkBytes: 3 });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('发送者');
    const [file] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: 'resume.txt', size: 5, mimeType: 'text/plain' }],
    );
    const first = await store.writeUploadChunk(
      owner.room.code,
      file?.id ?? '',
      owner.memberToken,
      new Blob(['hel']).stream(),
      0,
      3,
      sha256('hel'),
      file?.fingerprint ?? '',
      new AbortController().signal,
    );
    expect(first).toMatchObject({ status: 'uploading', uploadedBytes: 3 });

    const completed = await store.writeUploadChunk(
      owner.room.code,
      file?.id ?? '',
      owner.memberToken,
      new Blob(['lo']).stream(),
      3,
      2,
      sha256('lo'),
      file?.fingerprint ?? '',
      new AbortController().signal,
    );
    expect(completed).toMatchObject({ status: 'ready', uploadedBytes: 5 });
    const download = await store.getDownload(
      owner.room.code,
      completed.id,
      owner.memberToken,
    );
    expect(await readFile(download.path, 'utf8')).toBe('hello');
  });
});
