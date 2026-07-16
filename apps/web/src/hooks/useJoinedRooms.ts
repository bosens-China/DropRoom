import { useCallback, useEffect, useState } from 'react';
import {
  getJoinedRoomSummaries,
  subscribeJoinedRooms,
  type JoinedRoomSummary,
} from '../utils/roomRegistry';

/** 订阅用户已加入的房间列表 */
export function useJoinedRooms(): {
  rooms: JoinedRoomSummary[];
  refresh: () => void;
} {
  const [rooms, setRooms] = useState<JoinedRoomSummary[]>(() =>
    getJoinedRoomSummaries(),
  );

  const refresh = useCallback(() => {
    setRooms(getJoinedRoomSummaries());
  }, []);

  useEffect(() => subscribeJoinedRooms(refresh), [refresh]);

  return { rooms, refresh };
}
