import type { RoomSnapshot } from '@droproom/api/domain';
import { useEffect, useState } from 'react';
import { ApiRequestError, errorMessage } from '../api/client';
import { createRoom, joinRoomByCode } from '../utils/roomActions';

interface RoomAccessNotifier {
  success: (content: string) => void;
  error: (content: string) => void;
}

interface UseRoomAccessOptions {
  notify: RoomAccessNotifier;
  onCreated: (room: RoomSnapshot) => void;
  onJoined: (room: RoomSnapshot) => void;
}

/** 首页创建、加入与服务端限流交互 */
export function useRoomAccess({
  notify,
  onCreated,
  onJoined,
}: UseRoomAccessOptions) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((remaining) => (remaining <= 1 ? 0 : remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const room = await createRoom();
      notify.success(`已创建房间：${room.name}`);
      onCreated(room);
    } catch (error: unknown) {
      notify.error(errorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const join = async (code: string) => {
    if (lockoutTime > 0) {
      notify.error(`尝试次数过多，请 ${lockoutTime} 秒后再试`);
      return;
    }

    setJoining(true);
    try {
      const room = await joinRoomByCode(code);
      setJoinOpen(false);
      notify.success(`已加入房间：${room.name}`);
      onJoined(room);
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.retryAfterMs) {
        setLockoutTime(Math.ceil(error.retryAfterMs / 1000));
      }
      notify.error(errorMessage(error));
    } finally {
      setJoining(false);
    }
  };

  return {
    joinOpen,
    creating,
    joining,
    lockoutTime,
    openCreate: () => void create(),
    openJoin: () => setJoinOpen(true),
    closeJoin: () => setJoinOpen(false),
    join,
  };
}
