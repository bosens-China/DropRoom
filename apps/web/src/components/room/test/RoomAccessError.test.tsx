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
  DropRoomLogo: () => <span>DropRoom</span>,
}));

vi.mock('../../layout/AppSettingsBar', () => ({
  AppSettingsBar: () => <button type="button">打开设置</button>,
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

  it('新成员加入前展示首页顶栏和昵称设置入口', async () => {
    const onJoin = vi.fn();
    await act(async () => {
      root.render(
        <RoomAccessError
          message="缺少当前房间的成员凭证，请重新加入"
          missingSession
          joining={false}
          onJoin={onJoin}
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('header')?.textContent).toContain(
      'DropRoom',
    );
    expect(container.querySelector('header')?.textContent).toContain(
      '打开设置',
    );
    expect(container.textContent).toContain('加入前可在右上角修改昵称');
    expect(container.textContent).not.toContain('缺少当前房间的成员凭证');

    const joinButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '加入这个房间',
    );
    await act(async () => joinButton?.click());
    expect(onJoin).toHaveBeenCalledOnce();
  });
});
