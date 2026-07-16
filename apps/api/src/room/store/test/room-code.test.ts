import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestConfig } from '../../../test/config.js';

const randomInt = vi.hoisted(() => vi.fn());

vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  randomInt,
}));

import { RoomStore } from '../index.js';

const stores: RoomStore[] = [];

afterEach(async () => {
  randomInt.mockReset();
  await Promise.all(
    stores.splice(0).map(async (store) => {
      const storageRoot = store.config.storageRoot;
      await store.shutdown();
      await rm(storageRoot, { recursive: true, force: true });
    }),
  );
});

describe('房间码生成', () => {
  it('遇到存活房间码冲突时重新生成', async () => {
    randomInt
      .mockReturnValueOnce(12_345_678)
      .mockReturnValueOnce(12_345_678)
      .mockReturnValueOnce(87_654_321);
    const config = await createTestConfig();
    const store = new RoomStore(config);
    stores.push(store);
    await store.initialize();

    const first = store.createRoom('房主一', '房间一');
    const second = store.createRoom('房主二', '房间二');

    expect(first.room.code).toBe('12345678');
    expect(second.room.code).toBe('87654321');
    expect(randomInt).toHaveBeenCalledTimes(3);
  });
});
