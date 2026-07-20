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

  it('拒绝越权或破坏分片完整性的请求', async () => {
    const config = await createTestConfig({ uploadChunkBytes: 3 });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const owner = store.createRoom('发送者');
    const other = store.joinRoom(owner.room.code, '其他成员');
    const [ownedFile] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: 'private.bin', size: 5, mimeType: 'application/octet-stream' }],
    );
    await expect(
      store.writeUploadChunk(
        owner.room.code,
        ownedFile?.id ?? '',
        other.memberToken,
        new Blob(['hel']).stream(),
        0,
        3,
        sha256('hel'),
        ownedFile?.fingerprint ?? '',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const cases = [
      {
        code: 'INVALID_CHUNK_SIZE',
        body: 'hell',
        offset: 0,
        length: 4,
        hash: sha256('hell'),
        fingerprint: undefined,
      },
      {
        code: 'UPLOAD_OFFSET_MISMATCH',
        body: 'hel',
        offset: 1,
        length: 3,
        hash: sha256('hel'),
        fingerprint: undefined,
      },
      {
        code: 'FILE_FINGERPRINT_MISMATCH',
        body: 'hel',
        offset: 0,
        length: 3,
        hash: sha256('hel'),
        fingerprint: 'b'.repeat(64),
      },
      {
        code: 'CHUNK_HASH_MISMATCH',
        body: 'hel',
        offset: 0,
        length: 3,
        hash: sha256('wrong'),
        fingerprint: undefined,
      },
      {
        code: 'INCOMPLETE_CHUNK',
        body: 'he',
        offset: 0,
        length: 3,
        hash: sha256('he'),
        fingerprint: undefined,
      },
      {
        code: 'UPLOAD_TOO_LARGE',
        body: 'hel',
        offset: 0,
        length: 2,
        hash: sha256('hel'),
        fingerprint: undefined,
      },
    ];

    for (const testCase of cases) {
      const [file] = store.reserveUploadBatch(
        owner.room.code,
        owner.memberToken,
        [
          {
            name: `${testCase.code}.bin`,
            size: 5,
            mimeType: 'application/octet-stream',
          },
        ],
      );
      await expect(
        store.writeUploadChunk(
          owner.room.code,
          file?.id ?? '',
          owner.memberToken,
          new Blob([testCase.body]).stream(),
          testCase.offset,
          testCase.length,
          testCase.hash,
          testCase.fingerprint ?? file?.fingerprint ?? '',
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: testCase.code });
    }
  });
});
