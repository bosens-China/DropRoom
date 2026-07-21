import { Input, Modal, Segmented, Switch } from 'antd';
import type { ThemeMode } from '../../utils/preferences';

interface SettingsModalProps {
  open: boolean;
  nickname: string;
  themeMode: ThemeMode;
  browserNotifications: boolean;
  saving: boolean;
  onNicknameChange: (value: string) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onBrowserNotificationsChange: (enabled: boolean) => void;
  onSave: () => void | Promise<void>;
  onClose: () => void;
}

/** 应用设置弹窗：昵称、主题等个人偏好 */
export function SettingsModal({
  open,
  nickname,
  themeMode,
  browserNotifications,
  saving,
  onNicknameChange,
  onThemeModeChange,
  onBrowserNotificationsChange,
  onSave,
  onClose,
}: SettingsModalProps) {
  return (
    <Modal
      title="设置"
      open={open}
      onOk={() => void onSave()}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ disabled: !nickname.trim(), loading: saving }}
      centered
      destroyOnHidden
    >
      <div className="space-y-5">
        <div>
          <label
            htmlFor="settings-nickname"
            className="block text-sm font-medium mb-2"
          >
            昵称
          </label>
          <Input
            id="settings-nickname"
            value={nickname}
            onChange={(event) => onNicknameChange(event.target.value)}
            onPressEnter={() => {
              if (!saving) void onSave();
            }}
            maxLength={15}
            showCount
            autoFocus
          />
          <p className="text-xs text-[var(--dr-text-muted)] mt-2">
            昵称保存在当前浏览器，进入房间后展示给其他成员。
          </p>
        </div>

        <div>
          <span className="block text-sm font-medium mb-2">主题</span>
          <Segmented
            block
            value={themeMode}
            onChange={(value) => onThemeModeChange(value as ThemeMode)}
            options={[
              { label: '浅色', value: 'light' },
              { label: '深色', value: 'dark' },
              { label: '跟随系统', value: 'system' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="block text-sm font-medium">浏览器消息通知</span>
            <p className="text-xs text-[var(--dr-text-muted)] mt-1">
              开启并保存后申请通知权限；页面在后台时提醒其他成员发来的文字和文件。
            </p>
          </div>
          <Switch
            checked={browserNotifications}
            onChange={onBrowserNotificationsChange}
            aria-label="浏览器消息通知"
          />
        </div>

        <div className="rounded-lg dr-chat-bg px-4 py-3 space-y-2">
          <p className="text-xs text-[var(--dr-text-muted)] leading-relaxed">
            DropRoom 是临时文件传输工具。房间在 24 小时到期或连续 5
            分钟无人在线后自动销毁，不保留历史记录。
          </p>
          <p className="text-xs text-[var(--dr-text-muted)] leading-relaxed">
            昵称会在加入房间时发送给服务器并展示给房间成员；主题、通知与房间布局仅保存在本机浏览器。
          </p>
        </div>
      </div>
    </Modal>
  );
}
