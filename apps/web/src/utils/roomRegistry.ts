import type { RoomCredentials, RoomSnapshot } from '@droproom/api/domain';

const JOINED_ROOMS_KEY = 'droproom-joined-rooms';
const ROOMS_CHANGED_EVENT = 'droproom-rooms-changed';
const unavailableRoomKey = (roomId: string) =>
  `droproom-unavailable-room-${roomId}`;

export interface JoinedRoomEntry {
  roomId: string;
  room: RoomSnapshot;
  joinedAt: number;
  lastVisitedAt: number;
}

export interface JoinedRoomSummary {
  entry: JoinedRoomEntry;
  room: RoomSnapshot | null;
}

function notifyRoomsChanged(): void {
  window.dispatchEvent(new Event(ROOMS_CHANGED_EVENT));
}

function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'string'
  );
}

function isJoinedRoomEntry(value: unknown): value is JoinedRoomEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'roomId' in value &&
    typeof value.roomId === 'string' &&
    'room' in value &&
    isRoomSnapshot(value.room) &&
    'joinedAt' in value &&
    typeof value.joinedAt === 'number' &&
    'lastVisitedAt' in value &&
    typeof value.lastVisitedAt === 'number'
  );
}

function readEntries(): JoinedRoomEntry[] {
  const raw = localStorage.getItem(JOINED_ROOMS_KEY);
  if (!raw) return [];

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const entries = value
      .filter(isJoinedRoomEntry)
      .map(({ roomId, room, joinedAt, lastVisitedAt }) => ({
        roomId,
        room,
        joinedAt,
        lastVisitedAt,
      }));
    const sanitized = JSON.stringify(entries);
    if (sanitized !== raw) {
      localStorage.setItem(JOINED_ROOMS_KEY, sanitized);
    }
    return entries;
  } catch {
    return [];
  }
}

function writeEntries(entries: JoinedRoomEntry[]): void {
  localStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(entries));
  notifyRoomsChanged();
}

export function saveRoomCredentials(credentials: RoomCredentials): void {
  sessionStorage.removeItem(unavailableRoomKey(credentials.room.code));
  const entries = readEntries();
  const now = Date.now();
  const existing = entries.find(
    (entry) => entry.roomId === credentials.room.code,
  );

  if (existing) {
    existing.room = credentials.room;
    existing.lastVisitedAt = now;
    writeEntries(entries);
    return;
  }

  writeEntries([
    ...entries,
    {
      roomId: credentials.room.code,
      room: credentials.room,
      joinedAt: now,
      lastVisitedAt: now,
    },
  ]);
}

export function updateRoomSnapshot(room: RoomSnapshot): void {
  const entries = readEntries();
  const entry = entries.find((item) => item.roomId === room.code);
  if (!entry) return;
  entry.room = room;
  writeEntries(entries);
}

export function getRoomSession(roomId: string): JoinedRoomEntry | null {
  return readEntries().find((entry) => entry.roomId === roomId) ?? null;
}

export function getJoinedRoomIds(): string[] {
  return readEntries().map((entry) => entry.roomId);
}

export function removeJoinedRoom(roomId: string): void {
  writeEntries(readEntries().filter((entry) => entry.roomId !== roomId));
}

export function markRoomUnavailable(
  roomId: string,
  message = '房间不存在或已销毁',
): void {
  sessionStorage.setItem(unavailableRoomKey(roomId), message);
}

export function getRoomUnavailableMessage(roomId: string): string | null {
  const message = sessionStorage.getItem(unavailableRoomKey(roomId));
  if (message === 'true') return '房间不存在或已销毁';
  return message;
}

export function isRoomUnavailable(roomId: string): boolean {
  return getRoomUnavailableMessage(roomId) !== null;
}

export function touchJoinedRoom(roomId: string): void {
  const entries = readEntries();
  const target = entries.find((entry) => entry.roomId === roomId);
  if (!target) return;
  target.lastVisitedAt = Date.now();
  writeEntries(entries);
}

export function pruneExpiredJoinedRooms(): void {
  const now = Date.now();
  const entries = readEntries();
  const valid = entries.filter(
    (entry) => Date.parse(entry.room.expiresAt) > now,
  );
  if (valid.length !== entries.length) writeEntries(valid);
}

export function getJoinedRoomSummaries(): JoinedRoomSummary[] {
  pruneExpiredJoinedRooms();
  return readEntries()
    .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
    .map((entry) => ({ entry, room: entry.room }));
}

export function getNextRoomIdAfterLeave(currentRoomId: string): string | null {
  return (
    getJoinedRoomSummaries().find(
      (summary) => summary.entry.roomId !== currentRoomId,
    )?.entry.roomId ?? null
  );
}

export function subscribeJoinedRooms(callback: () => void): () => void {
  const localHandler = () => callback();
  const storageHandler = (event: StorageEvent) => {
    if (event.key === JOINED_ROOMS_KEY) callback();
  };
  window.addEventListener(ROOMS_CHANGED_EVENT, localHandler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(ROOMS_CHANGED_EVENT, localHandler);
    window.removeEventListener('storage', storageHandler);
  };
}
