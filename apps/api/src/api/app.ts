import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Readable } from 'node:stream';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import type { ApiConfig } from '../config/env.js';
import type { AppLogger } from '../infrastructure/logger.js';
import { createLogger } from '../infrastructure/logger.js';
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from '../infrastructure/rate-limiter.js';
import type { ErrorResponse, RoomEvent } from '../room/domain.js';
import type { RoomStore } from '../room/store/index.js';
import { registerApiDocs } from './docs.js';
import { registerErrorHandlers } from './error-handlers.js';
import { getHealthResponse } from './health.js';
import {
  canPreviewInline,
  clearRoomSessionCookie,
  clientIp,
  contentLength,
  memberTokenFromRequest,
  requestDuration,
  roomMemberTokenFromCookie,
  safeContentDisposition,
  setRoomSessionCookie,
  type AppEnv,
} from './http.js';
import {
  createRoomWithRateLimit,
  joinRoomWithRateLimit,
} from './rate-limit.js';
import {
  cancelUploadRoute,
  createRoomRoute,
  createTextRoute,
  deleteFileRoute,
  dissolveRoomRoute,
  downloadFileRoute,
  getRoomRoute,
  healthRoute,
  joinRoomRoute,
  leaveRoomRoute,
  reserveUploadRoute,
  roomEventsRoute,
  updateNicknameRoute,
  updateRoomRoute,
  uploadFileRoute,
} from './openapi.js';

export function createApp(
  store: RoomStore,
  config: ApiConfig,
  rootLogger: AppLogger = createLogger(config),
  rateLimiter: RateLimiter = new InMemoryRateLimiter(),
) {
  const api = new OpenAPIHono<AppEnv>({
    defaultHook: (result, context) => {
      if (result.success) {
        return undefined;
      }

      return context.json<ErrorResponse>(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数不合法',
            issues: result.error.issues,
          },
        },
        400,
      );
    },
  });

  api.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: '成员凭证',
    description: '创建或加入房间后返回的 memberToken',
  });
  api.openAPIRegistry.registerComponent('securitySchemes', 'RoomCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'droproom_<roomCode>',
    description: '创建或加入房间后写入的 HttpOnly 房间会话 Cookie',
  });

  api.use('*', requestId());
  api.use(
    '*',
    cors({
      origin: config.corsOrigins,
      allowHeaders: [
        'Authorization',
        'Content-Type',
        'Upload-Offset',
        'X-Chunk-Sha256',
        'X-File-Fingerprint',
        'X-Request-Id',
      ],
      exposeHeaders: ['Content-Disposition', 'Content-Length', 'X-Request-Id'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 600,
      credentials: true,
    }),
  );
  api.use(
    '*',
    secureHeaders({
      // Web 与 API 开发时使用不同端口，图片预览和下载必须允许跨源读取。
      crossOriginResourcePolicy: 'cross-origin',
    }),
  );
  api.use('*', async (context, next) => {
    const startedAt = performance.now();
    const logger = rootLogger.child({
      requestId: context.get('requestId'),
      method: context.req.method,
      path: context.req.path,
    });
    context.set('logger', logger);
    context.set('requestStartedAt', startedAt);

    await next();

    const details = {
      status: context.res.status,
      responseTimeMs: requestDuration(context),
    };
    if (context.res.status >= 400) {
      logger.warn(details, '请求完成');
    } else {
      logger.info(details, '请求完成');
    }
  });

  const routes = api
    .openapi(healthRoute, (context) => {
      const response = getHealthResponse(rateLimiter);
      return context.json(response.body, response.status);
    })
    .openapi(createRoomRoute, async (context) => {
      const input = context.req.valid('json');
      const credentials = await createRoomWithRateLimit(
        store,
        rateLimiter,
        config,
        input.nickname,
        input.name,
        clientIp(context),
      );
      setRoomSessionCookie(
        context,
        config,
        credentials.room.code,
        credentials.memberToken,
      );
      return context.json(credentials, 201);
    })
    .openapi(joinRoomRoute, async (context) => {
      const { code } = context.req.valid('param');
      const input = context.req.valid('json');
      const credentials = await joinRoomWithRateLimit(
        store,
        rateLimiter,
        config,
        code,
        input.nickname,
        clientIp(context),
        input.memberToken ?? roomMemberTokenFromCookie(context, code),
      );
      setRoomSessionCookie(
        context,
        config,
        credentials.room.code,
        credentials.memberToken,
      );
      return context.json(credentials, 200);
    })
    .openapi(getRoomRoute, (context) => {
      const { code } = context.req.valid('param');
      const token = memberTokenFromRequest(context, code);
      const snapshot = store.getSnapshot(code, token);
      setRoomSessionCookie(context, config, code, token);
      return context.json(snapshot, 200);
    })
    .openapi(roomEventsRoute, (context) => {
      const { code } = context.req.valid('param');
      const token = memberTokenFromRequest(context, code);

      // 在开始流式响应前校验，确保鉴权错误仍能返回普通 JSON。
      store.getSnapshot(code, token);
      context.header('Cache-Control', 'no-cache, no-transform');
      context.header('X-Accel-Buffering', 'no');

      return streamSSE(context, async (stream) => {
        let finish: (() => void) | undefined;
        let writeChain = Promise.resolve();
        let closed = false;
        const completed = new Promise<void>((resolve) => {
          finish = resolve;
        });

        const close = () => {
          if (closed) {
            return;
          }
          closed = true;
          void writeChain
            .catch(() => undefined)
            .finally(() => {
              stream.close();
              finish?.();
            });
        };

        const send = (event: RoomEvent) => {
          writeChain = writeChain
            .then(() =>
              stream.writeSSE({
                id: event.id,
                event: event.type,
                data: JSON.stringify(event),
              }),
            )
            .catch(close);
        };

        const subscription = store.subscribe(code, token, {
          id: randomUUID(),
          send,
          close,
        });

        await stream.writeSSE({
          event: 'room.snapshot',
          data: JSON.stringify({
            type: 'room.snapshot',
            room: subscription.snapshot,
          }),
        });

        const heartbeat = setInterval(() => {
          writeChain = writeChain
            .then(() =>
              stream.writeSSE({
                event: 'heartbeat',
                data: JSON.stringify({ now: new Date().toISOString() }),
              }),
            )
            .catch(close);
        }, config.sseHeartbeatMs);
        heartbeat.unref();

        stream.onAbort(close);
        await completed;
        clearInterval(heartbeat);
        subscription.unsubscribe();
        await writeChain.catch(() => undefined);
      });
    })
    .openapi(updateNicknameRoute, (context) => {
      const { code } = context.req.valid('param');
      const { nickname } = context.req.valid('json');
      const token = memberTokenFromRequest(context, code);
      return context.json(store.updateNickname(code, token, nickname), 200);
    })
    .openapi(leaveRoomRoute, async (context) => {
      const { code } = context.req.valid('param');
      const token = memberTokenFromRequest(context, code);
      await store.leaveRoom(code, token);
      clearRoomSessionCookie(context, config, code);
      return context.json({ ok: true }, 200);
    })
    .openapi(updateRoomRoute, (context) => {
      const { code } = context.req.valid('param');
      const { name } = context.req.valid('json');
      const token = memberTokenFromRequest(context, code);
      return context.json(store.updateRoomName(code, token, name), 200);
    })
    .openapi(dissolveRoomRoute, async (context) => {
      const { code } = context.req.valid('param');
      const token = memberTokenFromRequest(context, code);
      await store.dissolveRoom(code, token);
      clearRoomSessionCookie(context, config, code);
      return context.json({ ok: true }, 200);
    })
    .openapi(createTextRoute, (context) => {
      const { code } = context.req.valid('param');
      const { content } = context.req.valid('json');
      const token = memberTokenFromRequest(context, code);
      return context.json(store.addText(code, token, content), 201);
    })
    .openapi(reserveUploadRoute, (context) => {
      const { code } = context.req.valid('param');
      const { files } = context.req.valid('json');
      const token = memberTokenFromRequest(context, code);
      return context.json(
        { files: store.reserveUploadBatch(code, token, files) },
        201,
      );
    })
    .openapi(uploadFileRoute, async (context) => {
      const { code, fileId } = context.req.valid('param');
      const headers = context.req.valid('header');
      const token = memberTokenFromRequest(context, code);
      const file = await store.writeUploadChunk(
        code,
        fileId,
        token,
        context.req.raw.body,
        headers['upload-offset'],
        contentLength(context.req.raw.headers),
        headers['x-chunk-sha256'],
        headers['x-file-fingerprint'],
        context.req.raw.signal,
      );
      return context.json(file, 200);
    })
    .openapi(cancelUploadRoute, async (context) => {
      const { code, fileId } = context.req.valid('param');
      const token = memberTokenFromRequest(context, code);
      return context.json(await store.cancelUpload(code, fileId, token), 200);
    })
    .openapi(deleteFileRoute, async (context) => {
      const { code, fileId } = context.req.valid('param');
      const token = memberTokenFromRequest(context, code);
      return context.json(await store.deleteFile(code, fileId, token), 200);
    })
    .openapi(downloadFileRoute, async (context) => {
      const { code, fileId } = context.req.valid('param');
      const { mode } = context.req.valid('query');
      const token = memberTokenFromRequest(context, code);
      const file = await store.beginDownload(code, fileId, token);
      const inline = mode === 'inline' && canPreviewInline(file.mimeType);
      const nodeStream = createReadStream(file.path);
      nodeStream.once('close', file.complete);
      nodeStream.once('error', file.complete);
      context.req.raw.signal.addEventListener('abort', () => {
        nodeStream.destroy();
      });

      return new Response(
        Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
        {
          headers: {
            'Content-Type': file.mimeType,
            'Content-Length': file.size.toString(),
            'Content-Disposition': safeContentDisposition(file.name, inline),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    });

  registerApiDocs(api, config);
  registerErrorHandlers(routes, rootLogger);

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
