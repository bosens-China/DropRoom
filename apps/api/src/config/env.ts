import { tmpdir } from 'node:os';
import { join } from 'node:path';
import 'dotenv/config';
import { z } from 'zod';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const positiveInteger = z.coerce.number().int().positive();
const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const routePath = z.string().regex(/^\/[a-z0-9./_-]*$/i);
const redisUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'redis:' || protocol === 'rediss:';
}, 'Redis 地址必须使用 redis:// 或 rediss://');
const corsOriginsString = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url()).min(1));

export const DEFAULT_API_CONFIG = {
  nodeEnv: 'development',
  port: 43_117,
  redisUrl: 'redis://127.0.0.1:46379',
  redisKeyPrefix: 'droproom',
  storageRoot: join(tmpdir(), 'droproom'),
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'info',
  openApiEnabled: true,
  openApiJsonPath: '/openapi.json',
  swaggerPath: '/docs',
  roomLifetimeMs: 24 * HOUR,
  disconnectGraceMs: 5 * MINUTE,
  maintenanceIntervalMs: 5 * SECOND,
  uploadReservationMs: HOUR,
  uploadChunkBytes: 2_000_000,
  sseHeartbeatMs: 15 * SECOND,
  maxMembersPerRoom: 9,
  maxTextLength: 20_000,
  maxFilesPerBatch: 50,
  maxBatchBytes: 300_000_000,
  maxRoomFileBytes: 1_000_000_000,
  maxGlobalFileBytes: 30_000_000_000,
  maxActiveUploadsPerMember: 3,
  maxFailedJoinsPerMinute: 10,
  maxRoomsCreatedPerWindow: 10,
  roomCreationWindowMs: 10 * MINUTE,
} as const;

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default(DEFAULT_API_CONFIG.nodeEnv),
    DROPROOM_API_PORT: positiveInteger.default(DEFAULT_API_CONFIG.port),
    DROPROOM_REDIS_URL: redisUrl.optional(),
    DROPROOM_REDIS_KEY_PREFIX: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9:_-]+$/i)
      .default(DEFAULT_API_CONFIG.redisKeyPrefix),
    DROPROOM_STORAGE_ROOT: z
      .string()
      .min(1)
      .default(DEFAULT_API_CONFIG.storageRoot),
    DROPROOM_CORS_ORIGINS: corsOriginsString.optional(),
    DROPROOM_LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default(DEFAULT_API_CONFIG.logLevel),
    DROPROOM_OPENAPI_ENABLED: booleanString.default(
      DEFAULT_API_CONFIG.openApiEnabled,
    ),
    DROPROOM_OPENAPI_JSON_PATH: routePath.default(
      DEFAULT_API_CONFIG.openApiJsonPath,
    ),
    DROPROOM_SWAGGER_PATH: routePath.default(DEFAULT_API_CONFIG.swaggerPath),
    DROPROOM_ROOM_LIFETIME_MS: positiveInteger.default(
      DEFAULT_API_CONFIG.roomLifetimeMs,
    ),
    DROPROOM_DISCONNECT_GRACE_MS: positiveInteger.default(
      DEFAULT_API_CONFIG.disconnectGraceMs,
    ),
    DROPROOM_MAINTENANCE_INTERVAL_MS: positiveInteger.default(
      DEFAULT_API_CONFIG.maintenanceIntervalMs,
    ),
    DROPROOM_UPLOAD_RESERVATION_MS: positiveInteger.default(
      DEFAULT_API_CONFIG.uploadReservationMs,
    ),
    DROPROOM_UPLOAD_CHUNK_BYTES: positiveInteger.default(
      DEFAULT_API_CONFIG.uploadChunkBytes,
    ),
    DROPROOM_SSE_HEARTBEAT_MS: positiveInteger.default(
      DEFAULT_API_CONFIG.sseHeartbeatMs,
    ),
    DROPROOM_MAX_MEMBERS_PER_ROOM: positiveInteger.default(
      DEFAULT_API_CONFIG.maxMembersPerRoom,
    ),
    DROPROOM_MAX_TEXT_LENGTH: positiveInteger.default(
      DEFAULT_API_CONFIG.maxTextLength,
    ),
    DROPROOM_MAX_FILES_PER_BATCH: positiveInteger.default(
      DEFAULT_API_CONFIG.maxFilesPerBatch,
    ),
    DROPROOM_MAX_BATCH_BYTES: positiveInteger.default(
      DEFAULT_API_CONFIG.maxBatchBytes,
    ),
    DROPROOM_MAX_ROOM_FILE_BYTES: positiveInteger.default(
      DEFAULT_API_CONFIG.maxRoomFileBytes,
    ),
    DROPROOM_GLOBAL_FILE_BYTES: positiveInteger.default(
      DEFAULT_API_CONFIG.maxGlobalFileBytes,
    ),
    DROPROOM_MAX_ACTIVE_UPLOADS: positiveInteger.default(
      DEFAULT_API_CONFIG.maxActiveUploadsPerMember,
    ),
    DROPROOM_MAX_FAILED_JOINS_PER_MINUTE: positiveInteger.default(
      DEFAULT_API_CONFIG.maxFailedJoinsPerMinute,
    ),
    DROPROOM_MAX_ROOMS_PER_WINDOW: positiveInteger.default(
      DEFAULT_API_CONFIG.maxRoomsCreatedPerWindow,
    ),
    DROPROOM_ROOM_CREATION_WINDOW_MS: positiveInteger.default(
      DEFAULT_API_CONFIG.roomCreationWindowMs,
    ),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.DROPROOM_CORS_ORIGINS === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DROPROOM_CORS_ORIGINS'],
        message: '生产环境必须填写允许访问 API 的前端来源',
      });
    }

    if (
      environment.NODE_ENV === 'production' &&
      environment.DROPROOM_REDIS_URL === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DROPROOM_REDIS_URL'],
        message: '生产环境必须填写 Redis 地址',
      });
    }

    if (
      environment.DROPROOM_OPENAPI_JSON_PATH ===
      environment.DROPROOM_SWAGGER_PATH
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DROPROOM_SWAGGER_PATH'],
        message: 'Swagger UI 路径不能与 OpenAPI JSON 路径相同',
      });
    }

    if (
      environment.DROPROOM_MAX_BATCH_BYTES >
      environment.DROPROOM_MAX_ROOM_FILE_BYTES
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DROPROOM_MAX_BATCH_BYTES'],
        message: '单批文件上限不能大于单房间文件上限',
      });
    }

    if (
      environment.DROPROOM_MAX_ROOM_FILE_BYTES >
      environment.DROPROOM_GLOBAL_FILE_BYTES
    ) {
      context.addIssue({
        code: 'custom',
        path: ['DROPROOM_MAX_ROOM_FILE_BYTES'],
        message: '单房间文件上限不能大于全局文件上限',
      });
    }
  });

export type ApiConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  redisUrl: string;
  redisKeyPrefix: string;
  storageRoot: string;
  corsOrigins: string[];
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
  openApiEnabled: boolean;
  openApiJsonPath: string;
  swaggerPath: string;
  roomLifetimeMs: number;
  disconnectGraceMs: number;
  maintenanceIntervalMs: number;
  uploadReservationMs: number;
  uploadChunkBytes: number;
  sseHeartbeatMs: number;
  maxMembersPerRoom: number;
  maxTextLength: number;
  maxFilesPerBatch: number;
  maxBatchBytes: number;
  maxRoomFileBytes: number;
  maxGlobalFileBytes: number;
  maxActiveUploadsPerMember: number;
  maxFailedJoinsPerMinute: number;
  maxRoomsCreatedPerWindow: number;
  roomCreationWindowMs: number;
};

export function loadApiConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.DROPROOM_API_PORT,
    redisUrl: parsed.DROPROOM_REDIS_URL ?? DEFAULT_API_CONFIG.redisUrl,
    redisKeyPrefix: parsed.DROPROOM_REDIS_KEY_PREFIX,
    storageRoot: parsed.DROPROOM_STORAGE_ROOT,
    corsOrigins: parsed.DROPROOM_CORS_ORIGINS ?? [
      ...DEFAULT_API_CONFIG.corsOrigins,
    ],
    logLevel: parsed.DROPROOM_LOG_LEVEL,
    openApiEnabled: parsed.DROPROOM_OPENAPI_ENABLED,
    openApiJsonPath: parsed.DROPROOM_OPENAPI_JSON_PATH,
    swaggerPath: parsed.DROPROOM_SWAGGER_PATH,
    roomLifetimeMs: parsed.DROPROOM_ROOM_LIFETIME_MS,
    disconnectGraceMs: parsed.DROPROOM_DISCONNECT_GRACE_MS,
    maintenanceIntervalMs: parsed.DROPROOM_MAINTENANCE_INTERVAL_MS,
    uploadReservationMs: parsed.DROPROOM_UPLOAD_RESERVATION_MS,
    uploadChunkBytes: parsed.DROPROOM_UPLOAD_CHUNK_BYTES,
    sseHeartbeatMs: parsed.DROPROOM_SSE_HEARTBEAT_MS,
    maxMembersPerRoom: parsed.DROPROOM_MAX_MEMBERS_PER_ROOM,
    maxTextLength: parsed.DROPROOM_MAX_TEXT_LENGTH,
    maxFilesPerBatch: parsed.DROPROOM_MAX_FILES_PER_BATCH,
    maxBatchBytes: parsed.DROPROOM_MAX_BATCH_BYTES,
    maxRoomFileBytes: parsed.DROPROOM_MAX_ROOM_FILE_BYTES,
    maxGlobalFileBytes: parsed.DROPROOM_GLOBAL_FILE_BYTES,
    maxActiveUploadsPerMember: parsed.DROPROOM_MAX_ACTIVE_UPLOADS,
    maxFailedJoinsPerMinute: parsed.DROPROOM_MAX_FAILED_JOINS_PER_MINUTE,
    maxRoomsCreatedPerWindow: parsed.DROPROOM_MAX_ROOMS_PER_WINDOW,
    roomCreationWindowMs: parsed.DROPROOM_ROOM_CREATION_WINDOW_MS,
  };
}
