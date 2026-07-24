import type { RoomSnapshot } from '@droproom/api/domain';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBrowserNotificationsEnabled } from '../../utils/preferences';
import { getRoomSession, saveRoomCredentials } from '../../utils/roomRegistry';

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
    longTextFileThreshold: 5_000,
    maxFilesPerBatch: 50,
    maxBatchBytes: 500_000_000,
    items: [],
  };
}

class TestEventSource {
  static readonly CLOSED = 2;
  static instances: TestEventSource[] = [];
  readonly readyState = 1;
  onerror: (() => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, EventListener[]>();

  constructor() {
    TestEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: EventListener): void {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  emit(name: string, payload: unknown): void {
    const event = new MessageEvent(name, { data: JSON.stringify(payload) });
    this.listeners.get(name)?.forEach((listener) => listener(event));
  }

  close(): void {
    this.closed = true;
  }
}

let root: Root;
let container: HTMLDivElement;
const notify = { error: vi.fn() };
let syncState: ReturnType<typeof useRoomSync> | undefined;

function Harness() {
  const state = useRoomSync(ROOM_ID, notify);
  useEffect(() => {
    syncState = state;
    return () => {
      syncState = undefined;
    };
  }, [state]);
  return null;
}

function currentSync(): ReturnType<typeof useRoomSync> {
  if (!syncState) throw new Error('Hook 尚未渲染');
  return syncState;
}

describe('useRoomSync', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    requests.getRoom.mockReset();
    notify.error.mockReset();
    TestEventSource.instances = [];
    vi.stubGlobal('EventSource', TestEventSource);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    syncState = undefined;
    vi.restoreAllMocks();
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
    expect(currentSync().error).not.toBeNull();
    expect(currentSync().canJoin).toBe(true);

    await act(async () => {
      saveRoomCredentials({ memberToken: 'a'.repeat(32), room });
    });

    expect(currentSync().room?.code).toBe(ROOM_ID);
    expect(currentSync().error).toBeNull();
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

    expect(currentSync().error).not.toBeNull();
    expect(currentSync().canJoin).toBe(false);
    expect(getRoomSession(ROOM_ID)).toBeNull();
  });

  it('消费实时事件并在房间销毁后清理会话', async () => {
    const room = makeRoom();
    saveRoomCredentials({ memberToken: 'a'.repeat(32), room });
    requests.getRoom.mockResolvedValue(
      new Response(JSON.stringify(room), { status: 200 }),
    );
    await act(async () => root.render(<Harness />));

    const events = TestEventSource.instances[0];
    expect(events).toBeDefined();
    await act(async () => {
      events?.emit('presence.changed', {
        type: 'presence.changed',
        onlineMemberCount: 3,
        members: [],
      });
      events?.emit('item.created', {
        type: 'item.created',
        item: {
          id: '00000000-0000-4000-8000-000000000030',
          type: 'text',
          senderId: room.currentMemberId,
          senderNumberId: 1,
          senderNickname: '测试用户',
          content: 'hello',
          createdAt: new Date().toISOString(),
        },
      });
      events?.emit('room.updated', {
        type: 'room.updated',
        name: '更新后的房间',
        ownerMemberId: room.ownerMemberId,
      });
    });
    expect(currentSync().room?.onlineMemberCount).toBe(3);
    expect(currentSync().room?.items).toHaveLength(1);
    expect(currentSync().room?.name).toBe('更新后的房间');

    await act(async () => {
      events?.emit('room.destroyed', {
        type: 'room.destroyed',
        reason: 'dissolved',
      });
    });
    expect(currentSync().room).toBeNull();
    expect(currentSync().error).toBe('房间已被房主解散');
    expect(getRoomSession(ROOM_ID)).toBeNull();
    expect(events?.closed).toBe(true);

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    expect(currentSync().canJoin).toBe(false);
    expect(currentSync().error).toBe('房间已被房主解散');
  });

  it('页面在后台时通知其他成员发送的新内容', async () => {
    const room = makeRoom();
    const BrowserNotification = vi.fn();
    Object.defineProperty(BrowserNotification, 'permission', {
      value: 'granted',
    });
    vi.stubGlobal('Notification', BrowserNotification);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    setBrowserNotificationsEnabled(true);
    saveRoomCredentials({ memberToken: 'a'.repeat(32), room });
    requests.getRoom.mockResolvedValue(
      new Response(JSON.stringify(room), { status: 200 }),
    );
    await act(async () => root.render(<Harness />));

    const events = TestEventSource.instances[0];
    await act(async () => {
      events?.emit('item.created', {
        type: 'item.created',
        item: {
          id: '00000000-0000-4000-8000-000000000031',
          type: 'text',
          senderId: '00000000-0000-4000-8000-000000000002',
          senderNumberId: 2,
          senderNickname: '另一位成员',
          content: '后台消息',
          createdAt: new Date().toISOString(),
        },
      });
    });

    expect(BrowserNotification).toHaveBeenCalledWith(
      '邀请房间 · 另一位成员',
      expect.objectContaining({ body: '后台消息' }),
    );
  });
});
