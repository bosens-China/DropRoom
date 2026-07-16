import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/errors.js';
import { createTestConfig } from '../../../test/config.js';
import type { RoomEvent } from '../../domain.js';
import { RoomStore } from '../index.js';

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

describe('RoomStore', () => {
  it('保留文字历史并在房主主动退出后转移房主', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    const member = store.joinRoom(owner.room.code, '成员');
    const ownerEvents: RoomEvent[] = [];
    const memberEvents: RoomEvent[] = [];

    const ownerSubscription = store.subscribe(
      owner.room.code,
      owner.memberToken,
      {
        id: 'owner-connection',
        send: (event) => ownerEvents.push(event),
        close: () => undefined,
      },
    );
    const memberSubscription = store.subscribe(
      owner.room.code,
      member.memberToken,
      {
        id: 'member-connection',
        send: (event) => memberEvents.push(event),
        close: () => undefined,
      },
    );

    const message = store.addText(
      owner.room.code,
      member.memberToken,
      '跨设备文字',
    );
    expect(message.content).toBe('跨设备文字');
    expect(
      ownerEvents.some(
        (event) =>
          event.type === 'item.created' && event.item.id === message.id,
      ),
    ).toBe(true);

    await store.leaveRoom(owner.room.code, owner.memberToken);
    const snapshot = store.getSnapshot(owner.room.code, member.memberToken);
    expect(snapshot.ownerMemberId).toBe(snapshot.currentMemberId);
    expect(snapshot.members).toContainEqual(
      expect.objectContaining({ id: snapshot.currentMemberId, numberId: 2 }),
    );
    expect(snapshot.items).toContainEqual(message);

    ownerSubscription.unsubscribe();
    memberSubscription.unsubscribe();
  });

  it('流式保存文件，发送设备离线后其他成员仍可读取', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('发送者');
    const receiver = store.joinRoom(owner.room.code, '接收者');
    const receiverEvents: RoomEvent[] = [];
    const ownerSubscription = store.subscribe(
      owner.room.code,
      owner.memberToken,
      {
        id: 'owner-connection',
        send: () => undefined,
        close: () => undefined,
      },
    );
    const receiverSubscription = store.subscribe(
      owner.room.code,
      receiver.memberToken,
      {
        id: 'receiver-connection',
        send: (event) => receiverEvents.push(event),
        close: () => undefined,
      },
    );

    const [file] = store.reserveUploadBatch(
      owner.room.code,
      owner.memberToken,
      [
        {
          name: 'hello.txt',
          size: 5,
          mimeType: 'text/plain',
        },
      ],
    );
    expect(file).toBeDefined();
    expect(receiverEvents).toContainEqual(
      expect.objectContaining({
        type: 'item.created',
        reservedBytes: 5,
        usedBytes: 0,
      }),
    );

    const uploaded = await store.writeUploadChunk(
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
    expect(uploaded.status).toBe('ready');

    ownerSubscription.unsubscribe();
    const download = await store.getDownload(
      owner.room.code,
      uploaded.id,
      receiver.memberToken,
    );
    expect(await readFile(download.path, 'utf8')).toBe('hello');

    const snapshot = store.getSnapshot(owner.room.code, receiver.memberToken);
    expect(snapshot.usedBytes).toBe(5);
    expect(snapshot.reservedBytes).toBe(0);

    receiverSubscription.unsubscribe();
  });

  it('达到房间有效期后销毁状态和文件', async () => {
    let currentTime = 1_000;
    const config = await createTestConfig({ roomLifetimeMs: 100 });
    const store = new RoomStore(config, () => currentTime);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    currentTime += 101;
    await store.runMaintenance();

    expect(() =>
      store.getSnapshot(owner.room.code, owner.memberToken),
    ).toThrowError(ApiError);
  });

  it('房主断线满宽限期后转移，并在空房满宽限期后销毁', async () => {
    let currentTime = 1_000;
    const config = await createTestConfig({ disconnectGraceMs: 100 });
    const store = new RoomStore(config, () => currentTime);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    const member = store.joinRoom(owner.room.code, '第二位成员');
    const ownerSubscription = store.subscribe(
      owner.room.code,
      owner.memberToken,
      {
        id: 'owner',
        send: () => undefined,
        close: () => undefined,
      },
    );
    const memberSubscription = store.subscribe(
      owner.room.code,
      member.memberToken,
      {
        id: 'member',
        send: () => undefined,
        close: () => undefined,
      },
    );

    ownerSubscription.unsubscribe();
    currentTime += 99;
    await store.runMaintenance();
    expect(
      store.getSnapshot(owner.room.code, member.memberToken).ownerMemberId,
    ).toBe(owner.room.ownerMemberId);

    currentTime += 2;
    await store.runMaintenance();
    const transferred = store.getSnapshot(owner.room.code, member.memberToken);
    expect(transferred.ownerMemberId).toBe(transferred.currentMemberId);

    memberSubscription.unsubscribe();
    currentTime += 101;
    await store.runMaintenance();
    expect(() =>
      store.getSnapshot(owner.room.code, member.memberToken),
    ).toThrowError(ApiError);
  });

  it('限制房间成员数量，但允许已有成员使用凭证重连', async () => {
    const config = await createTestConfig({ maxMembersPerRoom: 2 });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    const member = store.joinRoom(owner.room.code, '成员');

    expect(() => store.joinRoom(owner.room.code, '第三人')).toThrowError(
      ApiError,
    );

    const reconnected = store.joinRoom(
      owner.room.code,
      '成员新昵称',
      member.memberToken,
    );
    expect(reconnected.memberToken).toBe(member.memberToken);
  });

  it('限制单批与房间容量，并原子限制成员上传并发', async () => {
    const config = await createTestConfig({
      maxBatchBytes: 10,
      maxRoomFileBytes: 15,
      maxActiveUploadsPerMember: 1,
    });
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

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

    expect(() =>
      store.reserveUploadBatch(owner.room.code, owner.memberToken, [
        {
          name: 'too-large.bin',
          size: 11,
          mimeType: 'application/octet-stream',
        },
      ]),
    ).toThrowError(ApiError);

    const files = store.reserveUploadBatch(owner.room.code, owner.memberToken, [
      { name: 'one.bin', size: 5, mimeType: 'application/octet-stream' },
      { name: 'two.bin', size: 5, mimeType: 'application/octet-stream' },
    ]);
    expect(() =>
      store.reserveUploadBatch(owner.room.code, owner.memberToken, [
        { name: 'no-space.bin', size: 6, mimeType: 'application/octet-stream' },
      ]),
    ).toThrowError(ApiError);

    let firstController:
      ReadableStreamDefaultController<Uint8Array> | undefined;
    const firstStream = new ReadableStream<Uint8Array>({
      start(controller) {
        firstController = controller;
      },
    });
    const firstUpload = store.writeUploadChunk(
      owner.room.code,
      files[0]?.id ?? '',
      owner.memberToken,
      firstStream,
      0,
      5,
      sha256('12345'),
      files[0]?.fingerprint ?? '',
      new AbortController().signal,
    );

    await expect(
      store.writeUploadChunk(
        owner.room.code,
        files[1]?.id ?? '',
        owner.memberToken,
        new Blob(['12345']).stream(),
        0,
        5,
        sha256('12345'),
        files[1]?.fingerprint ?? '',
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'TOO_MANY_ACTIVE_UPLOADS' });

    await store.cancelUpload(
      owner.room.code,
      files[0]?.id ?? '',
      owner.memberToken,
    );
    firstController?.close();
    await expect(firstUpload).rejects.toMatchObject({
      code: 'UPLOAD_CANCELLED',
    });

    ownerConnection.unsubscribe();
    receiverConnection.unsubscribe();
  });

  it('只有发送者或房主可以删除文件', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const owner = store.createRoom('房主');
    const sender = store.joinRoom(owner.room.code, '发送者');
    const other = store.joinRoom(owner.room.code, '其他成员');
    const connections = [
      [owner.memberToken, 'owner'],
      [sender.memberToken, 'sender'],
      [other.memberToken, 'other'],
    ].map(([token, id]) =>
      store.subscribe(owner.room.code, token ?? '', {
        id: id ?? '',
        send: () => undefined,
        close: () => undefined,
      }),
    );

    const [file] = store.reserveUploadBatch(
      owner.room.code,
      sender.memberToken,
      [{ name: 'private.txt', size: 1, mimeType: 'text/plain' }],
    );
    await expect(
      store.deleteFile(owner.room.code, file?.id ?? '', other.memberToken),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const deleted = await store.deleteFile(
      owner.room.code,
      file?.id ?? '',
      owner.memberToken,
    );
    expect(deleted.status).toBe('deleted');
    expect(
      store.getSnapshot(owner.room.code, sender.memberToken).reservedBytes,
    ).toBe(0);

    for (const connection of connections) {
      connection.unsubscribe();
    }
  });
});
