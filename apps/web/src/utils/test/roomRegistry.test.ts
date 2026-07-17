import type { RoomCredentials, RoomSnapshot } from '@droproom/api/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getJoinedRoomIds,
  getJoinedRoomSummaries,
  getNextRoomIdAfterLeave,
  removeJoinedRoom,
  saveRoomCredentials,
  touchJoinedRoom,
} from '../roomRegistry';

function makeRoom(
  code: string,
  expiresAt = Date.now() + 86_400_000,
): RoomSnapshot {
  return {
    code,
    name: `房间${code}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    currentMemberId: '00000000-0000-4000-8000-000000000001',
    ownerMemberId: '00000000-0000-4000-8000-000000000001',
    onlineMemberCount: 1,
    members: [],
    usedBytes: 0,
    reservedBytes: 0,
    maxFileBytes: 2_000_000_000,
    maxTextLength: 20_000,
    maxFilesPerBatch: 50,
    maxBatchBytes: 500_000_000,
    items: [],
  };
}

function saveRoom(code: string, expiresAt?: number): RoomCredentials {
  const credentials = {
    memberToken: `token-${code}`.padEnd(32, 'x'),
    room: makeRoom(code, expiresAt),
  };
  saveRoomCredentials(credentials);
  return credentials;
}

describe('roomRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('只保存房间快照，不把成员凭证写入本地存储', () => {
    saveRoom('12345678');

    expect(getJoinedRoomIds()).toEqual(['12345678']);
    expect(getJoinedRoomSummaries()[0]?.room?.name).toBe('房间12345678');
    expect(localStorage.getItem('droproom-joined-rooms')).not.toContain(
      'token-12345678',
    );
  });

  it('重复保存同一房间只更新缓存', () => {
    saveRoom('12345678');
    saveRoom('12345678');
    touchJoinedRoom('12345678');

    expect(getJoinedRoomIds()).toHaveLength(1);
  });

  it('读取旧缓存时移除本地成员凭证', () => {
    localStorage.setItem(
      'droproom-joined-rooms',
      JSON.stringify([
        {
          roomId: '12345678',
          memberToken: 'legacy-secret-token',
          room: makeRoom('12345678'),
          joinedAt: Date.now(),
          lastVisitedAt: Date.now(),
        },
      ]),
    );

    expect(getJoinedRoomIds()).toEqual(['12345678']);
    expect(localStorage.getItem('droproom-joined-rooms')).not.toContain(
      'legacy-secret-token',
    );
  });

  it('移除房间后获取下一个房间', () => {
    saveRoom('11111111');
    saveRoom('22222222');

    removeJoinedRoom('11111111');
    expect(getNextRoomIdAfterLeave('11111111')).toBe('22222222');
  });

  it('清理已过期的房间缓存', () => {
    saveRoom('12345678', Date.now() - 1);

    expect(getJoinedRoomSummaries()).toHaveLength(0);
  });
});
