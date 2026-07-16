import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomStore } from '../../room/store/index.js';
import { createTestConfig } from '../../test/config.js';
import { createApp } from '../app.js';

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

describe('房间主流程', () => {
  it('完成创建、加入、刷新、凭证重连、退出和重新加入', async () => {
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();
    const app = createApp(store, config);

    const createResponse = await app.request('/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: '房主', name: '主流程房间' }),
    });
    expect(createResponse.status).toBe(201);
    const owner = (await createResponse.json()) as {
      memberToken: string;
      room: { code: string };
    };

    const join = (memberToken?: string) =>
      app.request(`/rooms/${owner.room.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: '成员', memberToken }),
      });

    const joinResponse = await join();
    expect(joinResponse.status).toBe(200);
    const member = (await joinResponse.json()) as {
      memberToken: string;
      room: { currentMemberId: string };
    };

    const refreshResponse = await app.request(`/rooms/${owner.room.code}`, {
      headers: { Authorization: `Bearer ${member.memberToken}` },
    });
    expect(refreshResponse.status).toBe(200);

    const reconnectResponse = await join(member.memberToken);
    const reconnected = (await reconnectResponse.json()) as {
      memberToken: string;
      room: { currentMemberId: string };
    };
    expect(reconnected.memberToken).toBe(member.memberToken);
    expect(reconnected.room.currentMemberId).toBe(member.room.currentMemberId);

    const leaveResponse = await app.request(`/rooms/${owner.room.code}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${member.memberToken}` },
    });
    expect(leaveResponse.status).toBe(200);
    expect(
      (
        await app.request(`/rooms/${owner.room.code}`, {
          headers: { Authorization: `Bearer ${member.memberToken}` },
        })
      ).status,
    ).toBe(401);

    const rejoinResponse = await join(member.memberToken);
    expect(rejoinResponse.status).toBe(200);
    const rejoined = (await rejoinResponse.json()) as {
      memberToken: string;
      room: { currentMemberId: string };
    };
    expect(rejoined.memberToken).not.toBe(member.memberToken);
    expect(rejoined.room.currentMemberId).not.toBe(member.room.currentMemberId);
  });
});
