/* eslint-disable react-hooks/set-state-in-effect */
import type {
  RoomEventPayload,
  RoomItem,
  RoomSnapshot,
} from '@droproom/api/domain';
import { useEffect, useState } from 'react';
import {
  ApiRequestError,
  apiClient,
  credentialedRequest,
  errorMessage,
  roomEventsUrl,
  unwrapJson,
} from '../api/client';
import {
  getRoomSession,
  removeJoinedRoom,
  updateRoomSnapshot,
} from '../utils/roomRegistry';
import { useRoomActions } from './useRoomActions';

interface RoomSyncNotifier {
  error: (content: string) => void;
}

function upsertItem(items: RoomItem[], item: RoomItem): RoomItem[] {
  return items.some((candidate) => candidate.id === item.id)
    ? items.map((candidate) => (candidate.id === item.id ? item : candidate))
    : [...items, item];
}

function readEventPayload(data: string): RoomEventPayload | null {
  try {
    const value: unknown = JSON.parse(data);
    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      typeof value.type === 'string'
    ) {
      return value as RoomEventPayload;
    }
  } catch {
    return null;
  }
  return null;
}

function applyRoomEvent(
  current: RoomSnapshot | null,
  event: RoomEventPayload,
): RoomSnapshot | null {
  if (event.type === 'room.snapshot') return event.room;
  if (!current || event.type === 'room.destroyed') return null;

  if (event.type === 'presence.changed') {
    return {
      ...current,
      onlineMemberCount: event.onlineMemberCount,
      members: event.members,
    };
  }
  if (event.type === 'room.updated') {
    return {
      ...current,
      name: event.name,
      ownerMemberId: event.ownerMemberId,
    };
  }
  return {
    ...current,
    items: upsertItem(current.items, event.item),
    usedBytes: event.usedBytes ?? current.usedBytes,
    reservedBytes: event.reservedBytes ?? current.reservedBytes,
  };
}

export function useRoomSync(roomId: string, notify: RoomSyncNotifier) {
  const session = getRoomSession(roomId);
  const sessionKey = session?.joinedAt ?? 0;
  const [room, setRoom] = useState<RoomSnapshot | null>(session?.room ?? null);
  const [error, setError] = useState<string | null>(
    session ? null : '缺少当前房间的成员凭证，请重新加入',
  );

  const commitRoom = (nextRoom: RoomSnapshot | null) => {
    setRoom(nextRoom);
    if (nextRoom) updateRoomSnapshot(nextRoom);
  };

  useEffect(() => {
    const currentSession = getRoomSession(roomId);
    if (!currentSession) {
      setRoom(null);
      setError('缺少当前房间的成员凭证，请重新加入');
      return;
    }

    setRoom(currentSession.room);
    setError(null);
    let active = true;
    let events: EventSource | undefined;

    void apiClient.rooms[':code']
      .$get({ param: { code: roomId } }, credentialedRequest)
      .then((response) => unwrapJson<RoomSnapshot>(response))
      .then((snapshot) => {
        if (!active) return;
        commitRoom(snapshot);

        events = new EventSource(roomEventsUrl(roomId), {
          withCredentials: true,
        });
        const handleEvent = (rawEvent: Event) => {
          if (!(rawEvent instanceof MessageEvent)) return;
          const payload = readEventPayload(rawEvent.data);
          if (!payload) return;

          if (payload.type === 'room.destroyed') {
            removeJoinedRoom(roomId);
            setRoom(null);
            setError('房间已销毁');
            return;
          }
          setRoom((current) => {
            const next = applyRoomEvent(current, payload);
            if (next) updateRoomSnapshot(next);
            return next;
          });
        };

        const eventNames = [
          'room.snapshot',
          'presence.changed',
          'room.updated',
          'item.created',
          'item.updated',
          'room.destroyed',
        ] as const;
        eventNames.forEach((name) =>
          events?.addEventListener(name, handleEvent),
        );
        events.onerror = () => {
          if (events?.readyState === EventSource.CLOSED && active) {
            notify.error('实时连接已断开，正在等待重新连接');
          }
        };
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (
          requestError instanceof ApiRequestError &&
          (requestError.status === 401 || requestError.status === 404)
        ) {
          removeJoinedRoom(roomId);
          setRoom(null);
        }
        setError(errorMessage(requestError));
      });

    return () => {
      active = false;
      events?.close();
    };
  }, [roomId, notify, sessionKey]);

  const actions = useRoomActions({
    roomId,
    room,
    notify,
    setRoom,
  });

  return {
    room,
    onlineMembers: room?.members ?? [],
    error,
    myId: room?.currentMemberId ?? '',
    ...actions,
  };
}
