import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApiConfig } from '../config/env.js';
import { DEFAULT_API_CONFIG } from '../config/env.js';

export async function createTestConfig(
  overrides: Partial<ApiConfig> = {},
): Promise<ApiConfig> {
  return {
    ...DEFAULT_API_CONFIG,
    corsOrigins: [...DEFAULT_API_CONFIG.corsOrigins],
    nodeEnv: 'test',
    logLevel: 'silent',
    storageRoot: await mkdtemp(join(tmpdir(), 'droproom-api-test-')),
    maintenanceIntervalMs: 10,
    roomLifetimeMs: 60_000,
    disconnectGraceMs: 5_000,
    uploadReservationMs: 10_000,
    maxBatchBytes: 10_000,
    maxRoomFileBytes: 20_000,
    maxGlobalFileBytes: 100_000,
    ...overrides,
  };
}
