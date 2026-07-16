import { createRoute, z } from '@hono/zod-openapi';
import {
  createRoomSchema,
  createTextSchema,
  downloadQuerySchema,
  errorResponseSchema,
  fileItemSchema,
  fileParamSchema,
  healthResponseSchema,
  joinRoomSchema,
  reserveUploadBatchSchema,
  roomCredentialsSchema,
  roomParamSchema,
  roomSnapshotSchema,
  successResponseSchema,
  textItemSchema,
  updateNicknameSchema,
  updateRoomSchema,
  uploadBatchResponseSchema,
  uploadChunkHeaderSchema,
} from '../room/domain.js';

const jsonResponse = (description: string, schema: z.ZodType) => ({
  description,
  content: {
    'application/json': {
      schema,
    },
  },
});

const errorResponses = {
  400: jsonResponse('请求参数不合法', errorResponseSchema),
  401: jsonResponse('成员凭证无效', errorResponseSchema),
  403: jsonResponse('权限不足', errorResponseSchema),
  404: jsonResponse('资源不存在或已销毁', errorResponseSchema),
  409: jsonResponse('当前房间或资源状态不允许该操作', errorResponseSchema),
  413: jsonResponse('文字或文件超过限制', errorResponseSchema),
  429: jsonResponse('请求过于频繁', errorResponseSchema),
  500: jsonResponse('服务器内部错误', errorResponseSchema),
  503: jsonResponse('服务端临时容量不足', errorResponseSchema),
} as const;

const bearerSecurity = [{ Bearer: [] }];
const roomCookieSecurity = [{ RoomCookie: [] }, ...bearerSecurity];
const binarySchema = z.string().openapi({ format: 'binary' });

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['系统'],
  summary: '健康检查',
  responses: {
    200: jsonResponse('服务正常', healthResponseSchema),
    500: errorResponses[500],
    503: jsonResponse('Redis 依赖不可用', healthResponseSchema),
  },
});

export const createRoomRoute = createRoute({
  method: 'post',
  path: '/rooms',
  tags: ['房间'],
  summary: '创建临时房间',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createRoomSchema,
        },
      },
    },
  },
  responses: {
    201: jsonResponse('房间创建成功', roomCredentialsSchema),
    400: errorResponses[400],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

export const joinRoomRoute = createRoute({
  method: 'post',
  path: '/rooms/{code}/join',
  tags: ['房间'],
  summary: '加入或重连房间',
  request: {
    params: roomParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: joinRoomSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse('加入成功', roomCredentialsSchema),
    400: errorResponses[400],
    404: errorResponses[404],
    409: errorResponses[409],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

export const getRoomRoute = createRoute({
  method: 'get',
  path: '/rooms/{code}',
  tags: ['房间'],
  summary: '获取房间快照',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
  },
  responses: {
    200: jsonResponse('当前房间快照', roomSnapshotSchema),
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const roomEventsRoute = createRoute({
  method: 'get',
  path: '/rooms/{code}/events',
  tags: ['实时事件'],
  summary: '建立房间 SSE 连接',
  description:
    '连接建立后先发送 room.snapshot，后续发送成员、房间和内容变化事件。',
  security: roomCookieSecurity,
  request: { params: roomParamSchema },
  responses: {
    200: {
      description: 'SSE 事件流',
      content: {
        'text/event-stream': {
          schema: z.string(),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const updateNicknameRoute = createRoute({
  method: 'patch',
  path: '/rooms/{code}/members/me',
  tags: ['成员'],
  summary: '修改自己的昵称',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateNicknameSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse('更新后的房间快照', roomSnapshotSchema),
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const leaveRoomRoute = createRoute({
  method: 'post',
  path: '/rooms/{code}/leave',
  tags: ['成员'],
  summary: '主动退出房间',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
  },
  responses: {
    200: jsonResponse('退出成功', successResponseSchema),
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const updateRoomRoute = createRoute({
  method: 'patch',
  path: '/rooms/{code}',
  tags: ['房主'],
  summary: '修改房间名称',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateRoomSchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse('更新后的房间快照', roomSnapshotSchema),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const dissolveRoomRoute = createRoute({
  method: 'delete',
  path: '/rooms/{code}',
  tags: ['房主'],
  summary: '立即解散房间',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
  },
  responses: {
    200: jsonResponse('房间已解散', successResponseSchema),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const createTextRoute = createRoute({
  method: 'post',
  path: '/rooms/{code}/messages',
  tags: ['内容'],
  summary: '发送文字',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createTextSchema,
        },
      },
    },
  },
  responses: {
    201: jsonResponse('文字已写入房间历史', textItemSchema),
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    413: errorResponses[413],
    500: errorResponses[500],
  },
});

export const reserveUploadRoute = createRoute({
  method: 'post',
  path: '/rooms/{code}/uploads',
  tags: ['文件'],
  summary: '创建文件批次并预占容量',
  security: bearerSecurity,
  request: {
    params: roomParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: reserveUploadBatchSchema,
        },
      },
    },
  },
  responses: {
    201: jsonResponse('文件批次已创建', uploadBatchResponseSchema),
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    409: errorResponses[409],
    413: errorResponses[413],
    503: errorResponses[503],
    500: errorResponses[500],
  },
});

export const uploadFileRoute = createRoute({
  method: 'put',
  path: '/rooms/{code}/files/{fileId}/content',
  tags: ['文件'],
  summary: '上传文件分片',
  description:
    '请求体为当前分片字节。Upload-Offset 必须等于服务端已接收字节数。',
  security: bearerSecurity,
  request: {
    params: fileParamSchema,
    headers: uploadChunkHeaderSchema,
    body: {
      required: true,
      content: {
        'application/octet-stream': {
          schema: binarySchema,
        },
      },
    },
  },
  responses: {
    200: jsonResponse('文件上传完成', fileItemSchema),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    413: errorResponses[413],
    500: errorResponses[500],
  },
});

export const cancelUploadRoute = createRoute({
  method: 'post',
  path: '/rooms/{code}/files/{fileId}/cancel',
  tags: ['文件'],
  summary: '取消文件上传',
  security: bearerSecurity,
  request: {
    params: fileParamSchema,
  },
  responses: {
    200: jsonResponse('上传已取消', fileItemSchema),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

export const deleteFileRoute = createRoute({
  method: 'delete',
  path: '/rooms/{code}/files/{fileId}',
  tags: ['文件'],
  summary: '删除文件',
  security: bearerSecurity,
  request: {
    params: fileParamSchema,
  },
  responses: {
    200: jsonResponse('文件已删除', fileItemSchema),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

export const downloadFileRoute = createRoute({
  method: 'get',
  path: '/rooms/{code}/files/{fileId}/content',
  tags: ['文件'],
  summary: '预览或下载文件',
  security: roomCookieSecurity,
  request: {
    params: fileParamSchema,
    query: downloadQuerySchema,
  },
  responses: {
    200: {
      description: '文件内容',
      content: {
        'application/octet-stream': {
          schema: binarySchema,
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});
