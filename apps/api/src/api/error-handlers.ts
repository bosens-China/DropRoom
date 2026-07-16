import { OpenAPIHono } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppLogger } from '../infrastructure/logger.js';
import type { ErrorResponse } from '../room/domain.js';
import { ApiError } from '../shared/errors.js';
import type { AppEnv } from './http.js';
import { requestDuration } from './http.js';

export function registerErrorHandlers(
  routes: OpenAPIHono<AppEnv>,
  rootLogger: AppLogger,
): void {
  routes.notFound((context) =>
    context.json<ErrorResponse>(
      {
        error: {
          code: 'NOT_FOUND',
          message: '接口不存在',
        },
      },
      404,
    ),
  );

  routes.onError((error, context) => {
    const logger = context.get('logger') ?? rootLogger;

    if (error instanceof ApiError) {
      logger.warn(
        {
          status: error.status,
          errorCode: error.code,
          responseTimeMs: requestDuration(context),
        },
        error.message,
      );
      return context.json<ErrorResponse>(
        {
          error: {
            code: error.code,
            message: error.message,
            retryAfterMs: error.details?.retryAfterMs,
            issues: error.details?.issues,
          },
        },
        error.status as ContentfulStatusCode,
      );
    }

    logger.error(
      {
        error,
        responseTimeMs: requestDuration(context),
      },
      '未处理的接口异常',
    );
    return context.json<ErrorResponse>(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
        },
      },
      500,
    );
  });
}
