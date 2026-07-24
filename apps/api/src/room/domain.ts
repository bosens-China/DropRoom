import { z } from '@hono/zod-openapi';

export const roomCodeSchema = z
  .string()
  .regex(/^\d{8}$/)
  .openapi({ example: '01234567' });
export const nicknameSchema = z.string().trim().min(1).max(32);
export const roomNameSchema = z.string().trim().min(1).max(50);
export const memberTokenSchema = z
  .string()
  .min(32)
  .max(128)
  .openapi({ example: 'member-token-from-create-or-join-response' });

export const roomParamSchema = z.object({
  code: roomCodeSchema,
});

export const fileParamSchema = z.object({
  code: roomCodeSchema,
  fileId: z.uuid(),
});

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  name: roomNameSchema.optional(),
});

export const joinRoomSchema = z.object({
  nickname: nicknameSchema,
  memberToken: memberTokenSchema.optional(),
});

export const updateNicknameSchema = z.object({
  nickname: nicknameSchema,
});

export const updateRoomSchema = z.object({
  name: roomNameSchema,
});

export const createTextSchema = z.object({
  content: z.string().trim().min(1),
});

export const uploadFileInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default('application/octet-stream'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export const reserveUploadBatchSchema = z.object({
  files: z.array(uploadFileInputSchema).min(1),
});

export const uploadChunkHeaderSchema = z.object({
  'upload-offset': z.coerce.number().int().nonnegative(),
  'x-chunk-sha256': z.string().regex(/^[a-f0-9]{64}$/),
  'x-file-fingerprint': z.string().regex(/^[a-f0-9]{64}$/),
});

export const downloadQuerySchema = z.object({
  mode: z.enum(['inline', 'attachment']).default('attachment'),
});

export const memberViewSchema = z
  .object({
    id: z.uuid(),
    numberId: z.number().int().positive(),
    nickname: z.string(),
    joinedAt: z.iso.datetime(),
    isOwner: z.boolean(),
  })
  .openapi('Member');

export const textItemSchema = z
  .object({
    id: z.uuid(),
    type: z.literal('text'),
    senderId: z.uuid(),
    senderNumberId: z.number().int().positive(),
    senderNickname: z.string(),
    content: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi('TextItem');

export const fileStatusSchema = z.enum([
  'uploading',
  'ready',
  'failed',
  'cancelled',
  'deleted',
]);

export const fileItemSchema = z
  .object({
    id: z.uuid(),
    batchId: z.uuid(),
    type: z.literal('file'),
    senderId: z.uuid(),
    senderNumberId: z.number().int().positive(),
    senderNickname: z.string(),
    name: z.string(),
    size: z.number().int().nonnegative(),
    mimeType: z.string(),
    status: fileStatusSchema,
    uploadedBytes: z.number().int().nonnegative(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    chunkSize: z.number().int().positive(),
    createdAt: z.iso.datetime(),
  })
  .openapi('FileItem');

export const roomItemSchema = z
  .discriminatedUnion('type', [textItemSchema, fileItemSchema])
  .openapi('RoomItem');

export const roomSnapshotSchema = z
  .object({
    code: roomCodeSchema,
    name: z.string(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    currentMemberId: z.uuid(),
    ownerMemberId: z.uuid().nullable(),
    onlineMemberCount: z.number().int().nonnegative(),
    members: z.array(memberViewSchema),
    usedBytes: z.number().int().nonnegative(),
    reservedBytes: z.number().int().nonnegative(),
    maxFileBytes: z.number().int().positive(),
    maxTextLength: z.number().int().positive(),
    longTextFileThreshold: z.number().int().positive(),
    maxFilesPerBatch: z.number().int().positive(),
    maxBatchBytes: z.number().int().positive(),
    items: z.array(roomItemSchema),
  })
  .openapi('RoomSnapshot');

export const roomCredentialsSchema = z
  .object({
    memberToken: memberTokenSchema,
    room: roomSnapshotSchema,
  })
  .openapi('RoomCredentials');

export const uploadBatchResponseSchema = z
  .object({
    files: z.array(fileItemSchema),
  })
  .openapi('UploadBatchResponse');

export const successResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi('SuccessResponse');

export const healthResponseSchema = z
  .object({
    ok: z.boolean(),
    service: z.literal('droproom-api'),
    now: z.iso.datetime(),
    dependencies: z.object({
      redis: z.enum(['ready', 'unavailable', 'not_configured']),
    }),
  })
  .openapi('HealthResponse');

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      retryAfterMs: z.number().int().nonnegative().optional(),
      issues: z.unknown().optional(),
    }),
  })
  .openapi('ErrorResponse');

export type MemberView = z.infer<typeof memberViewSchema>;
export type TextItem = z.infer<typeof textItemSchema>;
export type FileStatus = z.infer<typeof fileStatusSchema>;
export type FileItem = z.infer<typeof fileItemSchema>;
export type RoomItem = z.infer<typeof roomItemSchema>;
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type RoomCredentials = z.infer<typeof roomCredentialsSchema>;
export type UploadBatchResponse = z.infer<typeof uploadBatchResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export type RoomEventPayload =
  | { type: 'room.snapshot'; room: RoomSnapshot }
  | {
      type: 'presence.changed';
      onlineMemberCount: number;
      members: MemberView[];
    }
  | { type: 'room.updated'; name: string; ownerMemberId: string | null }
  | {
      type: 'item.created';
      item: RoomItem;
      usedBytes?: number;
      reservedBytes?: number;
    }
  | {
      type: 'item.updated';
      item: RoomItem;
      usedBytes?: number;
      reservedBytes?: number;
    }
  | { type: 'room.destroyed'; reason: RoomDestroyReason };

export type RoomEvent = RoomEventPayload & {
  id: string;
  createdAt: string;
};

export type RoomDestroyReason = 'expired' | 'empty' | 'dissolved' | 'shutdown';
