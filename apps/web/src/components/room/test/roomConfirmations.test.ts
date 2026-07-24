import type { RoomSnapshot } from '@droproom/api/domain';
import { describe, expect, it } from 'vitest';
import { shouldConfirmRoomExit } from '../roomConfirmations';

const room = {
  onlineMemberCount: 1,
  items: [],
} as unknown as RoomSnapshot;

describe('shouldConfirmRoomExit', () => {
  it('在线人数大于2人或存在上传中的文件时要求确认', () => {
    expect(shouldConfirmRoomExit(room)).toBe(false);
    expect(shouldConfirmRoomExit({ ...room, onlineMemberCount: 2 })).toBe(
      false,
    );
    expect(shouldConfirmRoomExit({ ...room, onlineMemberCount: 3 })).toBe(true);
    expect(
      shouldConfirmRoomExit({
        ...room,
        items: [{ type: 'file', status: 'uploading' }],
      } as RoomSnapshot),
    ).toBe(true);
  });
});
