import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@ant-design/icons', () => ({
  HomeOutlined: () => <span />,
}));

vi.mock('../../brand/DropRoomLogo', () => ({
  DropRoomLogo: () => <span />,
}));

vi.mock('../../layout/AppSettingsBar', () => ({
  AppSettingsBar: () => <button type="button" />,
}));

import { RoomAccessError } from '../RoomAccessError';

let root: Root;
let container: HTMLDivElement;

describe('RoomAccessError', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('允许新成员从邀请页加入', async () => {
    const onJoin = vi.fn();
    const onBack = vi.fn();
    await act(async () => {
      root.render(
        <RoomAccessError
          message="缺少当前房间的成员凭证，请重新加入"
          canJoin
          joining={false}
          onJoin={onJoin}
          onBack={onBack}
        />,
      );
    });

    expect(container.querySelector('header button')).not.toBeNull();
    const buttons = [...container.querySelectorAll('button')];
    const joinButton = buttons.at(-1);
    await act(async () => joinButton?.click());
    expect(onJoin).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('房间已销毁时只提供返回首页入口', async () => {
    const onBack = vi.fn();
    const onJoin = vi.fn();
    await act(async () => {
      root.render(
        <RoomAccessError
          message="房间不存在或已销毁"
          canJoin={false}
          joining={false}
          onJoin={onJoin}
          onBack={onBack}
        />,
      );
    });

    const buttons = [...container.querySelectorAll('button')];
    const backButton = buttons.at(-1);
    await act(async () => backButton?.click());
    expect(onBack).toHaveBeenCalledOnce();
    expect(onJoin).not.toHaveBeenCalled();
  });
});
