import { useState } from 'react';
import { message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  getBrowserNotificationsEnabled,
  getMyNickname,
  setBrowserNotificationsEnabled,
  setMyNickname,
  type ThemeMode,
} from '../../utils/preferences';
import { SettingsModal } from './SettingsModal';

interface AppSettingsBarProps {
  /** header：顶栏右侧紧凑入口；embedded：侧栏底部嵌入 */
  variant?: 'header' | 'embedded';
  nickname?: string;
  onNicknameSave?: (nickname: string) => Promise<boolean>;
}

/** 用户信息与设置入口 */
export function AppSettingsBar({
  variant = 'header',
  nickname: roomNickname,
  onNicknameSave,
}: AppSettingsBarProps) {
  const { mode: themeMode, setMode: setThemeMode } = useAppTheme();
  const [messageApi, contextHolder] = message.useMessage();
  const [localNickname, setLocalNickname] = useState(getMyNickname);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(localNickname);
  const [themeInput, setThemeInput] = useState<ThemeMode>(themeMode);
  const [browserNotificationsInput, setBrowserNotificationsInput] = useState(
    getBrowserNotificationsEnabled,
  );
  const [saving, setSaving] = useState(false);
  const nickname = roomNickname ?? localNickname;

  const openSettings = () => {
    setNicknameInput(nickname);
    setThemeInput(themeMode);
    setBrowserNotificationsInput(getBrowserNotificationsEnabled());
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const nextNickname = nicknameInput.trim();
    if (!nextNickname) {
      messageApi.error('昵称不能为空');
      return;
    }

    setSaving(true);
    try {
      if (browserNotificationsInput) {
        if (!('Notification' in window)) {
          messageApi.error('当前浏览器不支持系统通知');
          setBrowserNotificationsInput(false);
          setBrowserNotificationsEnabled(false);
          return;
        }
        const permission =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission().catch(() => 'denied');
        if (permission !== 'granted') {
          messageApi.error('未获得通知权限，请在浏览器设置中允许通知');
          setBrowserNotificationsInput(false);
          setBrowserNotificationsEnabled(false);
          return;
        }
      }
      if (
        onNicknameSave &&
        nextNickname !== nickname &&
        !(await onNicknameSave(nextNickname))
      ) {
        return;
      }
      setMyNickname(nextNickname);
      setLocalNickname(nextNickname);
      setThemeMode(themeInput);
      setBrowserNotificationsEnabled(browserNotificationsInput);
      setSettingsOpen(false);
      messageApi.success('设置已保存');
    } finally {
      setSaving(false);
    }
  };

  const isEmbedded = variant === 'embedded';

  return (
    <>
      {contextHolder}
      <div
        className={
          isEmbedded ? 'shrink-0 border-t dr-surface' : 'flex items-center'
        }
      >
        <button
          type="button"
          onClick={openSettings}
          aria-label="打开设置"
          className={`flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors ${
            isEmbedded
              ? 'w-full px-3 py-2.5 hover:opacity-80'
              : 'px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <div
            className="w-8 h-8 rounded-lg bg-[#006EFF] text-white flex items-center justify-center text-sm font-semibold shrink-0"
            aria-hidden
          >
            {nickname.slice(0, 1).toUpperCase()}
          </div>
          <div
            className={`min-w-0 flex-1 text-left ${isEmbedded ? '' : 'hidden sm:block'}`}
          >
            <p className="text-sm font-medium truncate leading-tight">
              {nickname}
            </p>
            <p className="text-[10px] text-[var(--dr-text-muted)] truncate">
              临时身份
            </p>
          </div>
          <SettingOutlined
            className={`text-[var(--dr-text-muted)] shrink-0 ${isEmbedded ? 'text-base' : 'text-sm'}`}
          />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        nickname={nicknameInput}
        themeMode={themeInput}
        browserNotifications={browserNotificationsInput}
        saving={saving}
        onNicknameChange={setNicknameInput}
        onThemeModeChange={setThemeInput}
        onBrowserNotificationsChange={setBrowserNotificationsInput}
        onSave={saveSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
