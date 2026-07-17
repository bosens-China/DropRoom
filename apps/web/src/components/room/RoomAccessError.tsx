import { Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { DropRoomLogo } from '../brand/DropRoomLogo';
import { AppSettingsBar } from '../layout/AppSettingsBar';

interface RoomAccessErrorProps {
  message: string;
  missingSession: boolean;
  joining: boolean;
  onJoin: () => void;
  onBack: () => void;
}

/** 邀请链接加入入口与失效房间提示 */
export function RoomAccessError({
  message,
  missingSession,
  joining,
  onJoin,
  onBack,
}: RoomAccessErrorProps) {
  return (
    <div className="min-h-dvh w-full flex flex-col overflow-x-hidden dr-page-bg dr-safe-top">
      <header className="shrink-0 h-14 border-b dr-surface dr-safe-inline">
        <div className="h-full flex items-center justify-between px-5 sm:px-8">
          <DropRoomLogo size="sm" />
          <AppSettingsBar variant="header" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-6 dr-safe-inline">
        <div className="w-full px-5">
          <div className="max-w-md w-full mx-auto dr-surface rounded-2xl border p-8 text-center shadow-sm">
            <h2
              className={`text-lg font-bold mb-2 ${missingSession ? 'text-[var(--dr-text)]' : 'text-red-500'}`}
            >
              {missingSession ? '加入房间' : '无法进入房间'}
            </h2>
            <p className="text-sm text-[var(--dr-text-muted)] mb-6">
              {missingSession
                ? '加入前可在右上角修改昵称，房间内其他成员会看到它。'
                : message}
            </p>
            <Button
              type="primary"
              block
              loading={missingSession && joining}
              onClick={missingSession ? onJoin : onBack}
              className="rounded-lg"
              icon={missingSession ? undefined : <HomeOutlined />}
            >
              {missingSession ? '加入这个房间' : '返回首页'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
