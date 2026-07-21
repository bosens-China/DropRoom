import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@ant-design/icons', () => ({
  CrownOutlined: () => <span />,
  EditOutlined: () => <span />,
  TeamOutlined: () => <span />,
  UserOutlined: () => <span />,
}));

vi.mock('../../brand/DropRoomLogo', () => ({
  DropRoomLogo: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      DropRoom
    </button>
  ),
}));

vi.mock('../../layout/AppSettingsBar', () => ({
  AppSettingsBar: () => <div />,
}));

import { RoomMemberPanel } from '../RoomMemberPanel';

let root: Root;
let container: HTMLDivElement;

describe('RoomMemberPanel', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('点击品牌入口时复用房间退出确认流程', async () => {
    const onExit = vi.fn();
    await act(async () => {
      root.render(
        <RoomMemberPanel
          myId="member-id"
          members={[]}
          onExit={onExit}
          onEditNickname={vi.fn()}
          onSaveNickname={vi.fn(async () => true)}
        />,
      );
    });

    await act(async () => container.querySelector('button')?.click());
    expect(onExit).toHaveBeenCalledOnce();
  });
});
