import pino from 'pino';
import type { DestinationStream, Logger } from 'pino';
import type { ApiConfig } from '../config/env.js';

export type AppLogger = Logger;

export function createLogger(
  config: ApiConfig,
  destination?: DestinationStream,
): AppLogger {
  const options: pino.LoggerOptions = {
    level: config.logLevel,
    base: {
      service: 'droproom-api',
      environment: config.nodeEnv,
    },
    redact: {
      paths: [
        'authorization',
        'memberToken',
        'token',
        'req.headers.authorization',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      error: pino.stdSerializers.err,
    },
  };

  return destination === undefined ? pino(options) : pino(options, destination);
}
