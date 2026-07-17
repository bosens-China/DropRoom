import type { RoomSnapshot } from '@droproom/api/domain';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveRoomCredentials } from '../../utils/roomRegistry';

const requests = vi.hoisted(() => ({
  getRoom: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  ApiRequestError: class ApiRequestError extends Error {
    readonly status: number;

    constructor(status: number, response: { error: { message: string } }) {
      super(response.error.message);
      this.status = status;
    }
  },
  apiClient: {
    rooms: {
      ':code': { $get: requests.getRoom },
    },
  },
  credentialedRequest: { init: { credentials: 'include' } },
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : '请求失败',
  roomEventsUrl: (roomId: string) => `/rooms/${roomId}/events`,
  unwrapJson: async (response: Response) => response.json(),
}));

vi.mock('../useRoomActions', () => ({
  useRoomActions: () => ({}),
}));

import { ApiRequestError } from '../../api/client';
import { useRoomSync } from '../useRoomSync';

const ROOM_ID = '12345678';
const MISSING_SESSION_MESSAGE = '缺少当前房间的成员凭证，请重新加入';

function makeRoom(): RoomSnapshot {
  return {
    code: ROOM_ID,
    name: '邀请房间',
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
    maxFilesPerBatch: 50,
    maxBatchBytes: 500_000_000,
    items: [],
  };
}

class TestEventSource {
  static readonly CLOSED = 2;
  readonly readyState = 1;
  onerror: (() => void) | null = null;

  addEventListener(): void {}
  close(): void {}
}

let root: Root;
let container: HTMLDivElement;
const notify = { error: vi.fn() };

function Harness() {
  const { room, error, canJoin } = useRoomSync(ROOM_ID, notify);
  return (
    <div data-can-join={String(canJoin)}>{error ?? room?.name ?? '加载中'}</div>
  );
}

describe('useRoomSync', () => {
  beforeEach(() => {
    localStorage.clear();
    requests.getRoom.mockReset();
    notify.error.mockReset();
    vi.stubGlobal('EventSource', TestEventSource);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it('邀请链接加入成功后无需刷新即可恢复房间同步', async () => {
    const room = makeRoom();
    requests.getRoom.mockResolvedValue(
      new Response(JSON.stringify(room), { status: 200 }),
    );

    await act(async () => {
      root.render(<Harness />);
    });
    expect(container.textContent).toBe(MISSING_SESSION_MESSAGE);
    expect(container.firstElementChild?.getAttribute('data-can-join')).toBe(
      'true',
    );

    await act(async () => {
      saveRoomCredentials({ memberToken: 'a'.repeat(32), room });
    });

    expect(container.textContent).toBe('邀请房间');
    expect(requests.getRoom).toHaveBeenCalledOnce();
  });

  it('房间已销毁时不再提供重新加入入口', async () => {
    const room = makeRoom();
    saveRoomCredentials({ memberToken: 'a'.repeat(32), room });
    requests.getRoom.mockRejectedValue(
      new ApiRequestError(404, {
        error: {
          code: 'ROOM_NOT_FOUND',
          message: '房间不存在或已销毁',
        },
      }),
    );

    await act(async () => {
      root.render(<Harness />);
    });

    expect(container.textContent).toBe('房间不存在或已销毁');
    expect(container.firstElementChild?.getAttribute('data-can-join')).toBe(
      'false',
    );
  });
});
