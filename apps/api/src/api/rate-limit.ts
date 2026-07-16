import type { ApiConfig } from '../config/env.js';
import type { RateLimiter } from '../infrastructure/rate-limiter.js';
import type { RoomCredentials } from '../room/domain.js';
import type { RoomStore } from '../room/store/index.js';
import { ApiError } from '../shared/errors.js';

export async function createRoomWithRateLimit(
  store: RoomStore,
  rateLimiter: RateLimiter,
  config: ApiConfig,
  nickname: string,
  name: string | undefined,
  ip: string,
): Promise<RoomCredentials> {
  const result = await rateLimiter.consume(
    'room-create',
    ip,
    config.maxRoomsCreatedPerWindow,
    config.roomCreationWindowMs,
  );
  if (!result.allowed) {
    throw new ApiError(
      429,
      'ROOM_CREATION_RATE_LIMITED',
      '创建房间过于频繁，请稍后再试',
      { retryAfterMs: result.retryAfterMs },
    );
  }

  return store.createRoom(nickname, name);
}

export async function joinRoomWithRateLimit(
  store: RoomStore,
  rateLimiter: RateLimiter,
  config: ApiConfig,
  code: string,
  nickname: string,
  ip: string,
  memberToken?: string,
): Promise<RoomCredentials> {
  const result = await rateLimiter.check(
    'join-failed',
    ip,
    config.maxFailedJoinsPerMinute,
    60_000,
  );
  if (!result.allowed) {
    throw new ApiError(
      429,
      'JOIN_RATE_LIMITED',
      '加入尝试过于频繁，请稍后再试',
      { retryAfterMs: result.retryAfterMs },
    );
  }

  try {
    return store.joinRoom(code, nickname, memberToken);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.code === 'ROOM_NOT_FOUND') {
      await rateLimiter.consume(
        'join-failed',
        ip,
        config.maxFailedJoinsPerMinute,
        60_000,
      );
    }
    throw error;
  }
}
