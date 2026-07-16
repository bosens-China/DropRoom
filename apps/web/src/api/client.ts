import type { AppType } from '@droproom/api/app';
import type { ErrorResponse } from '@droproom/api/domain';
import { hc } from 'hono/client';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:43117';

export const apiClient = hc<AppType>(API_BASE_URL);

export const credentialedRequest = {
  init: { credentials: 'include' as const },
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterMs?: number;

  constructor(status: number, response: ErrorResponse) {
    super(response.error.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = response.error.code;
    this.retryAfterMs = response.error.retryAfterMs;
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const error = value.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

export async function unwrapJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    if (isErrorResponse(payload)) {
      throw new ApiRequestError(response.status, payload);
    }
    throw new Error(`请求失败（${response.status}）`);
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败，请稍后重试';
}

export function roomEventsUrl(code: string): string {
  return apiClient.rooms[':code'].events.$url({ param: { code } }).toString();
}

export function fileContentUrl(
  code: string,
  fileId: string,
  mode: 'inline' | 'attachment',
): string {
  return apiClient.rooms[':code'].files[':fileId'].content
    .$url({
      param: { code, fileId },
      query: { mode },
    })
    .toString();
}
