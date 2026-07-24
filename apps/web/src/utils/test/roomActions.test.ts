import type { RoomCredentials, RoomSnapshot } from '@droproom/api/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requests = vi.hoisted(() => ({
  create: vi.fn(),
  join: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  apiClient: {
    rooms: {
      $post: requests.create,
      ':code': {
        join: {
          $post: requests.join,
        },
      },
    },
  },
  credentialedRequest: { init: { credentials: 'include' } },
  unwrapJson: async (response: Response) => response.json(),
}));

import { createRoom, joinRoomByCode } from '../roomActions';

function makeCredentials(code = '12345678'): RoomCredentials {
  const room: RoomSnapshot = {
    code,
    name: '设计评审室',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    currentMemberId: '00000000-0000-4000-8000-000000000001',
    ownerMemberId: '00000000-0000-4000-8000-000000000001',
    onlineMemberCount: 1,
    members: [],
    usedBytes: 0,
    reservedBytes: 0,
    maxFileBytes: 2_000_000_000,
    maxTextLength: 20_000,
    longTextFileThreshold: 5_000,
    maxFilesPerBatch: 50,
    maxBatchBytes: 500_000_000,
    items: [],
  };
  return { memberToken: 'x'.repeat(32), room };
}

describe('roomActions', () => {
  beforeEach(() => {
    localStorage.clear();
    requests.create.mockReset();
    requests.join.mockReset();
    localStorage.setItem('droproom-user-nickname', '测试设备');
  });

  it('通过 hc 一键创建房间并缓存房间快照', async () => {
    requests.create.mockResolvedValue(
      new Response(JSON.stringify(makeCredentials()), { status: 201 }),
    );

    const room = await createRoom();

    expect(requests.create).toHaveBeenCalledWith(
      { json: { nickname: '测试设备' } },
      { init: { credentials: 'include' } },
    );
    expect(room.code).toBe('12345678');
  });

  it('重新加入时使用房间 Cookie', async () => {
    const credentials = makeCredentials();
    requests.create.mockResolvedValue(
      new Response(JSON.stringify(credentials), { status: 201 }),
    );
    requests.join.mockResolvedValue(
      new Response(JSON.stringify(credentials), { status: 200 }),
    );
    await createRoom();

    await joinRoomByCode('1234 5678');

    expect(requests.join).toHaveBeenCalledWith(
      {
        param: { code: '12345678' },
        json: { nickname: '测试设备' },
      },
      { init: { credentials: 'include' } },
    );
  });
});
