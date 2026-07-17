import { Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

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
    <div className="min-h-dvh w-full flex items-center justify-center p-6 dr-chat-bg">
      <div className="max-w-md w-full dr-surface rounded-2xl border p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-red-500 mb-2">无法进入房间</h2>
        <p className="text-sm text-[var(--dr-text-muted)] mb-6">{message}</p>
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
  );
}
