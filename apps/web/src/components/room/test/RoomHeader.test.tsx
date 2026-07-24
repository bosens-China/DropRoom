import type { RoomSnapshot } from '@droproom/api/domain';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Button: ({
    children,
    icon,
    onClick,
    ...props
  }: {
    children?: ReactNode;
    icon?: ReactNode;
    onClick?: () => void | Promise<void>;
  }) => (
    <button type="button" onClick={() => void onClick?.()} {...props}>
      {icon}
      {children}
    </button>
  ),
  Dropdown: ({ children }: { children: ReactNode }) => children,
  Progress: () => <div />,
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@ant-design/icons', () => ({
  CheckOutlined: () => <span data-testid="copy-success" />,
  CopyOutlined: () => <span data-testid="copy-icon" />,
  EditOutlined: () => <span />,
  LogoutOutlined: () => <span />,
  MenuUnfoldOutlined: () => <span />,
  MoreOutlined: () => <span />,
  StopOutlined: () => <span />,
  UserOutlined: () => <span />,
}));

vi.mock('../RoomCountdownRing', () => ({
  RoomCountdownRing: () => <div />,
}));

import { RoomHeader } from '../RoomHeader';

const room = {
  code: '12345678',
  name: '测试房间',
  ownerMemberId: 'owner',
  usedBytes: 0,
  reservedBytes: 0,
  maxFileBytes: 1_000_000_000,
} as unknown as RoomSnapshot;

let root: Root;
let container: HTMLDivElement;

function renderHeader(onCopyInviteLink: () => Promise<boolean>) {
  return act(async () => {
    root.render(
      <RoomHeader
        room={room}
        roomId="12345678"
        myId="member"
        timeLeft={3600}
        memberCount={2}
        onCopyInviteLink={onCopyInviteLink}
        onEditRoomName={vi.fn()}
        onDissolve={vi.fn()}
        onExit={vi.fn()}
      />,
    );
  });
}

describe('RoomHeader', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('仅在复制成功后展示成功状态', async () => {
    await renderHeader(vi.fn().mockResolvedValue(false));
    const copyButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('1234 5678'),
    );

    await act(async () => copyButton?.click());
    expect(container.querySelector('[data-testid="copy-success"]')).toBeNull();

    await renderHeader(vi.fn().mockResolvedValue(true));
    await act(async () => copyButton?.click());
    expect(
      container.querySelector('[data-testid="copy-success"]'),
    ).not.toBeNull();
  });

  it('中窄屏只在第二行显示成员数量', async () => {
    await renderHeader(vi.fn().mockResolvedValue(true));
    const desktopMemberCount = [...container.querySelectorAll('span')].find(
      (element) => element.textContent === '2 人',
    );

    expect(desktopMemberCount?.classList.contains('hidden')).toBe(true);
    expect(desktopMemberCount?.classList.contains('md:inline-flex')).toBe(true);
  });
});
