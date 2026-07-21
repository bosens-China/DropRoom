import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

import { DropRoomLogo } from '../DropRoomLogo';

let root: Root;
let container: HTMLDivElement;

describe('DropRoomLogo', () => {
  beforeEach(() => {
    navigate.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('默认通过应用路由返回首页', async () => {
    await act(async () => root.render(<DropRoomLogo size="sm" />));

    const button = container.querySelector('button');
    await act(async () => button?.click());

    expect(navigate).toHaveBeenCalledWith({ to: '/' });
    expect(button?.classList.contains('cursor-pointer')).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('返回首页');
  });

  it('房间页可在跳转前执行退出确认', async () => {
    const onClick = vi.fn();
    await act(async () => root.render(<DropRoomLogo onClick={onClick} />));

    await act(async () => container.querySelector('button')?.click());

    expect(onClick).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});
