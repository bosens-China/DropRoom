import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { performance } from 'node:perf_hooks';
import type { ApiConfig } from '../config/env.js';
import type { AppLogger } from '../infrastructure/logger.js';
import { ApiError } from '../shared/errors.js';

export type AppEnv = {
  Variables: {
    logger: AppLogger;
    requestId: string;
    requestStartedAt: number;
  };
};

export function memberTokenFromAuthorization(
  authorization: string | undefined,
): string {
  const prefix = 'Bearer ';
  if (authorization === undefined || !authorization.startsWith(prefix)) {
    throw new ApiError(401, 'MEMBER_TOKEN_REQUIRED', '缺少成员凭证');
  }

  const token = authorization.slice(prefix.length).trim();
  if (token.length === 0) {
    throw new ApiError(401, 'MEMBER_TOKEN_REQUIRED', '缺少成员凭证');
  }
  return token;
}

export function roomCookieName(code: string): string {
  return `droproom_${code}`;
}

export function roomMemberTokenFromCookie(
  context: Context<AppEnv>,
  code: string,
): string | undefined {
  return getCookie(context, roomCookieName(code));
}

export function memberTokenFromRequest(
  context: Context<AppEnv>,
  code: string,
): string {
  const authorization = context.req.header('authorization');
  if (authorization !== undefined) {
    return memberTokenFromAuthorization(authorization);
  }

  const token = roomMemberTokenFromCookie(context, code);
  if (token === undefined) {
    throw new ApiError(401, 'MEMBER_TOKEN_REQUIRED', '缺少成员凭证');
  }
  return token;
}

export function setRoomSessionCookie(
  context: Context<AppEnv>,
  config: ApiConfig,
  code: string,
  token: string,
): void {
  setCookie(context, roomCookieName(code), token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.nodeEnv === 'production',
    maxAge: Math.ceil(config.roomLifetimeMs / 1_000),
  });
}

export function clearRoomSessionCookie(
  context: Context<AppEnv>,
  config: ApiConfig,
  code: string,
): void {
  deleteCookie(context, roomCookieName(code), {
    path: '/',
    secure: config.nodeEnv === 'production',
  });
}

export function clientIp(context: Context<AppEnv>): string {
  const forwardedFor = context.req.header('x-forwarded-for');
  if (forwardedFor !== undefined) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  const realIp = context.req.header('x-real-ip');
  if (realIp !== undefined && realIp.trim().length > 0) {
    return realIp.trim();
  }

  try {
    return getConnInfo(context).remote.address ?? 'unknown';
  } catch {
    // app.request 测试环境没有真实 socket。
    return 'unknown';
  }
}

export function contentLength(headers: Headers): number | undefined {
  const rawValue = headers.get('content-length');
  if (rawValue === null) {
    return undefined;
  }

  const value = Number(rawValue);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function safeContentDisposition(
  filename: string,
  inline: boolean,
): string {
  const fallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 120);
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback || 'file'}"; filename*=UTF-8''${encoded}`;
}

export function canPreviewInline(mimeType: string): boolean {
  return [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/avif',
  ].includes(mimeType.toLowerCase());
}

export function requestDuration(context: Context<AppEnv>): number {
  const startedAt = context.get('requestStartedAt') as number | undefined;
  return startedAt === undefined
    ? 0
    : Math.round(performance.now() - startedAt);
}
