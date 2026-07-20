import { createHash } from 'node:crypto';
import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/errors.js';
import { createTestConfig } from '../../../test/config.js';
import { RoomStore } from '../index.js';

const stores: RoomStore[] = [];

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.shutdown()));
});

function subscribe(store: RoomStore, code: string, token: string, id: string) {
  return store.subscribe(code, token, {
    id,
    send: () => undefined,
    close: () => undefined,
  });
}

describe('RoomStore 关键边界', () => {
  it('初始化时保留存储根目录并清理遗留内容', async () => {
    const config = await createTestConfig();
    const staleFile = join(config.storageRoot, 'stale.tmp');
    await writeFile(staleFile, 'stale');
    const store = new RoomStore(config);
    stores.push(store);

    await store.initialize();

    expect((await stat(config.storageRoot)).isDirectory()).toBe(true);
    await expect(stat(staleFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('允许9名成员并拒绝第10名成员', async () => {
    const config = await createTestConfig({ maxMembersPerRoom: 9 });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    for (let index = 1; index < 9; index += 1) {
      store.joinRoom(owner.room.code, `成员${index}`);
    }

    expect(() => store.joinRoom(owner.room.code, '第10名成员')).toThrowError(
      ApiError,
    );
  });

  it('跨房间累计预占容量不超过单实例上限', async () => {
    const config = await createTestConfig({
      maxBatchBytes: 10,
      maxRoomFileBytes: 10,
      maxGlobalFileBytes: 15,
    });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const firstOwner = store.createRoom('房主一');
    const secondOwner = store.createRoom('房主二');

    store.reserveUploadBatch(firstOwner.room.code, firstOwner.memberToken, [
      { name: 'first.bin', size: 10, mimeType: 'application/octet-stream' },
    ]);

    expect(() =>
      store.reserveUploadBatch(secondOwner.room.code, secondOwner.memberToken, [
        {
          name: 'second.bin',
          size: 6,
          mimeType: 'application/octet-stream',
        },
      ]),
    ).toThrowError(ApiError);
  });

  it('房主在宽限期内重连后保持房主身份', async () => {
    let currentTime = 1_000;
    const config = await createTestConfig({ disconnectGraceMs: 100 });
    const store = new RoomStore(config, () => currentTime);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    const member = store.joinRoom(owner.room.code, '成员');
    const ownerConnection = subscribe(
      store,
      owner.room.code,
      owner.memberToken,
      'owner',
    );
    const memberConnection = subscribe(
      store,
      owner.room.code,
      member.memberToken,
      'member',
    );

    ownerConnection.unsubscribe();
    currentTime += 50;
    const reconnected = store.joinRoom(
      owner.room.code,
      '房主',
      owner.memberToken,
    );
    const ownerReconnection = subscribe(
      store,
      owner.room.code,
      reconnected.memberToken,
      'owner-reconnected',
    );

    currentTime += 60;
    await store.runMaintenance();
    expect(
      store.getSnapshot(owner.room.code, member.memberToken).ownerMemberId,
    ).toBe(owner.room.ownerMemberId);

    ownerReconnection.unsubscribe();
    memberConnection.unsubscribe();
  });

  it('上传连接中断后保留容量并从原文件继续上传', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('发送者');
    const receiver = store.joinRoom(owner.room.code, '接收者');
    const ownerConnection = subscribe(
      store,
      owner.room.code,
      owner.memberToken,
      'owner',
    );
    const receiverConnection = subscribe(
      store,
      owner.room.code,
      receiver.memberToken,
      'receiver',
    );
    const [interrupted] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: 'retry.txt', size: 5, mimeType: 'text/plain' }],
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      store.writeUploadChunk(
        owner.room.code,
        interrupted?.id ?? '',
        owner.memberToken,
        new Blob(['hello']).stream(),
        0,
        5,
        sha256('hello'),
        interrupted?.fingerprint ?? '',
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_INTERRUPTED' });
    expect(
      store.getSnapshot(owner.room.code, owner.memberToken).reservedBytes,
    ).toBe(5);

    await expect(
      store.writeUploadChunk(
        owner.room.code,
        interrupted?.id ?? '',
        owner.memberToken,
        new Blob(['hello']).stream(),
        0,
        5,
        sha256('hello'),
        interrupted?.fingerprint ?? '',
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ status: 'ready' });

    ownerConnection.unsubscribe();
    receiverConnection.unsubscribe();
  });

  it('上传预留过期后释放容量并删除临时分片', async () => {
    let currentTime = 1_000;
    const config = await createTestConfig({
      uploadChunkBytes: 3,
      uploadReservationMs: 100,
    });
    const store = new RoomStore(config, () => currentTime);
    stores.push(store);
    await store.initialize();
    const owner = store.createRoom('发送者');
    const [file] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: 'expired.bin', size: 5, mimeType: 'application/octet-stream' }],
    );
    await store.writeUploadChunk(
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
    const partialPath = join(
      config.storageRoot,
      owner.room.code,
      `${file?.id}.part`,
    );
    expect((await stat(partialPath)).isFile()).toBe(true);

    currentTime += 101;
    await store.runMaintenance();

    const snapshot = store.getSnapshot(owner.room.code, owner.memberToken);
    expect(snapshot.reservedBytes).toBe(0);
    expect(snapshot.items).toContainEqual(
      expect.objectContaining({ id: file?.id, status: 'failed' }),
    );
    await expect(stat(partialPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('房主主动解散后删除物理文件和房间状态', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    const receiver = store.joinRoom(owner.room.code, '接收者');
    const ownerConnection = subscribe(
      store,
      owner.room.code,
      owner.memberToken,
      'owner',
    );
    const receiverConnection = subscribe(
      store,
      owner.room.code,
      receiver.memberToken,
      'receiver',
    );
    const [file] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [{ name: 'cleanup.txt', size: 5, mimeType: 'text/plain' }],
    );
    await store.writeUploadChunk(
      owner.room.code,
      file?.id ?? '',
      owner.memberToken,
      new Blob(['hello']).stream(),
      0,
      5,
      sha256('hello'),
      file?.fingerprint ?? '',
      new AbortController().signal,
    );
    const download = await store.getDownload(
      owner.room.code,
      file?.id ?? '',
      receiver.memberToken,
    );
    expect((await stat(download.path)).isFile()).toBe(true);

    await store.dissolveRoom(owner.room.code, owner.memberToken);

    await expect(stat(download.path)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(() =>
      store.getSnapshot(owner.room.code, owner.memberToken),
    ).toThrowError(ApiError);

    ownerConnection.unsubscribe();
    receiverConnection.unsubscribe();
  });
});
