import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setMyNickname: vi.fn(),
  saveRoomNickname: vi.fn(),
  setBrowserNotificationsEnabled: vi.fn(),
  setThemeMode: vi.fn(),
}));

vi.mock('antd', () => ({
  message: {
    useMessage: () => [{ error: vi.fn(), success: vi.fn() }, null],
  },
}));

vi.mock('@ant-design/icons', () => ({
  GithubOutlined: () => <span data-testid="github-icon" />,
  SettingOutlined: () => <span />,
}));

vi.mock('../../../hooks/useAppTheme', () => ({
  useAppTheme: () => ({ mode: 'light', setMode: mocks.setThemeMode }),
}));

vi.mock('../../../utils/preferences', () => ({
  getBrowserNotificationsEnabled: () => false,
  getMyNickname: () => '本地昵称',
  setBrowserNotificationsEnabled: mocks.setBrowserNotificationsEnabled,
  setMyNickname: mocks.setMyNickname,
}));

vi.mock('../SettingsModal', () => ({
  SettingsModal: ({
    open,
    onBrowserNotificationsChange,
    onNicknameChange,
    onSave,
  }: {
    open: boolean;
    onBrowserNotificationsChange: (enabled: boolean) => void;
    onNicknameChange: (value: string) => void;
    onSave: () => void | Promise<void>;
  }) =>
    open ? (
      <div>
        <button
          type="button"
          data-action="notifications"
          onClick={() => onBrowserNotificationsChange(true)}
        />
        <button
          type="button"
          data-action="change"
          onClick={() => onNicknameChange('房间新昵称')}
        />
        <button
          type="button"
          data-action="save"
          onClick={() => void onSave()}
        />
      </div>
    ) : null,
}));

import { AppSettingsBar } from '../AppSettingsBar';

let root: Root;
let container: HTMLDivElement;

function Harness() {
  const [nickname, setNickname] = useState('房间旧昵称');
  return (
    <AppSettingsBar
      variant="embedded"
      nickname={nickname}
      onNicknameSave={async (nextNickname) => {
        mocks.saveRoomNickname(nextNickname);
        setNickname(nextNickname);
        return true;
      }}
    />
  );
}

describe('AppSettingsBar', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.setMyNickname.mockReset();
    mocks.saveRoomNickname.mockReset();
    mocks.setBrowserNotificationsEnabled.mockReset();
    mocks.setThemeMode.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it('在房间内保存昵称时同步后端和本地偏好', async () => {
    await act(async () => root.render(<Harness />));

    const openButton = container.querySelector<HTMLButtonElement>('button');
    expect(openButton).not.toBeNull();
    await act(async () => openButton?.click());

    const changeButton = container.querySelector<HTMLButtonElement>(
      'button[data-action="change"]',
    );
    const saveButton = container.querySelector<HTMLButtonElement>(
      'button[data-action="save"]',
    );
    await act(async () => changeButton?.click());
    await act(async () => saveButton?.click());

    expect(mocks.saveRoomNickname).toHaveBeenCalledWith('房间新昵称');
    expect(mocks.setMyNickname).toHaveBeenCalledWith('房间新昵称');
  });

  it('开启通知时申请浏览器权限并保存偏好', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission,
    });
    await act(async () => root.render(<Harness />));

    const openButton = container.querySelector<HTMLButtonElement>('button');
    await act(async () => openButton?.click());
    const notificationsButton = container.querySelector<HTMLButtonElement>(
      'button[data-action="notifications"]',
    );
    const saveButton = container.querySelector<HTMLButtonElement>(
      'button[data-action="save"]',
    );
    await act(async () => notificationsButton?.click());
    await act(async () => saveButton?.click());

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(mocks.setBrowserNotificationsEnabled).toHaveBeenCalledWith(true);
  });

  it('在 header 模式下不渲染 GitHub 源码链接', async () => {
    await act(async () =>
      root.render(<AppSettingsBar variant="header" nickname="测试用户" />),
    );

    const githubLink = container.querySelector<HTMLAnchorElement>(
      'a[aria-label="GitHub 源码"]',
    );
    expect(githubLink).toBeNull();
  });

  it('在 embedded 模式下渲染 GitHub 源码链接', async () => {
    await act(async () =>
      root.render(<AppSettingsBar variant="embedded" nickname="测试用户" />),
    );

    const githubLink = container.querySelector<HTMLAnchorElement>(
      'a[aria-label="GitHub 源码"]',
    );
    expect(githubLink).not.toBeNull();
    expect(githubLink?.getAttribute('href')).toBe(
      'https://github.com/bosens-China/DropRoom',
    );
  });
});
