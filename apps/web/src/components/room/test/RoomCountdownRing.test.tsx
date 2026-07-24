import type { RoomSnapshot } from '@droproom/api/domain';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Progress: () => <div />,
  Tooltip: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-tooltip={title}>{children}</div>
  ),
}));

import { RoomCountdownRing } from '../RoomCountdownRing';

const room: RoomSnapshot = {
  code: '12345678',
  name: '测试房间',
  createdAt: '2026-07-24T00:00:00.000Z',
  expiresAt: '2026-07-25T00:00:00.000Z',
  currentMemberId: '00000000-0000-4000-8000-000000000001',
  ownerMemberId: '00000000-0000-4000-8000-000000000001',
  onlineMemberCount: 1,
  members: [],
  usedBytes: 0,
  reservedBytes: 0,
  maxFileBytes: 1_000_000_000,
  maxTextLength: 20_000,
  longTextFileThreshold: 5_000,
  maxFilesPerBatch: 50,
  maxBatchBytes: 300_000_000,
  items: [],
};

let root: Root;
let container: HTMLDivElement;

describe('RoomCountdownRing', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('两小时外只在 Tooltip 展示时间，同时保留文字宽度', async () => {
    await act(async () => {
      root.render(<RoomCountdownRing room={room} timeLeft={7_200} />);
    });

    const text = container.querySelector('span');
    expect(text?.classList.contains('w-[2.75rem]')).toBe(true);
    expect(text?.classList.contains('invisible')).toBe(true);
    expect(container.firstElementChild?.getAttribute('data-tooltip')).toBe(
      '房间剩余 2:00',
    );

    await act(async () => {
      root.render(<RoomCountdownRing room={room} timeLeft={7_199} />);
    });
    const visibleText = container.querySelector('span');
    expect(visibleText?.classList.contains('visible')).toBe(true);
    expect(visibleText?.classList.contains('invisible')).toBe(false);
  });
});
