import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setMyNickname: vi.fn(),
  saveRoomNickname: vi.fn(),
  setThemeMode: vi.fn(),
}));

vi.mock('antd', () => ({
  message: {
    useMessage: () => [{ error: vi.fn(), success: vi.fn() }, null],
  },
}));

vi.mock('@ant-design/icons', () => ({
  SettingOutlined: () => <span />,
}));

vi.mock('../../../hooks/useAppTheme', () => ({
  useAppTheme: () => ({ mode: 'light', setMode: mocks.setThemeMode }),
}));

vi.mock('../../../utils/preferences', () => ({
  getMyNickname: () => '本地昵称',
  setMyNickname: mocks.setMyNickname,
}));

vi.mock('../SettingsModal', () => ({
  SettingsModal: ({
    open,
    onNicknameChange,
    onSave,
  }: {
    open: boolean;
    onNicknameChange: (value: string) => void;
    onSave: () => void | Promise<void>;
  }) =>
    open ? (
      <div>
        <button type="button" onClick={() => onNicknameChange('房间新昵称')}>
          修改测试昵称
        </button>
        <button type="button" onClick={() => void onSave()}>
          保存测试设置
        </button>
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
    mocks.setThemeMode.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it('在房间内保存昵称时同步后端和本地偏好', async () => {
    await act(async () => root.render(<Harness />));

    const openButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="打开设置"]',
    );
    expect(openButton).not.toBeNull();
    await act(async () => openButton?.click());

    const buttons = [...container.querySelectorAll('button')];
    const changeButton = buttons.find(
      (button) => button.textContent === '修改测试昵称',
    );
    const saveButton = buttons.find(
      (button) => button.textContent === '保存测试设置',
    );
    await act(async () => changeButton?.click());
    await act(async () => saveButton?.click());

    expect(mocks.saveRoomNickname).toHaveBeenCalledWith('房间新昵称');
    expect(mocks.setMyNickname).toHaveBeenCalledWith('房间新昵称');
    expect(container.textContent).toContain('房间新昵称');
  });
});
