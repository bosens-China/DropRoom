export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: {
    retryAfterMs?: number;
    issues?: unknown;
  };

  constructor(
    status: number,
    code: string,
    message: string,
    details?: {
      retryAfterMs?: number;
      issues?: unknown;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
