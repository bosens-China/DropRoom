import { Button } from 'antd';

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
    <div className="min-h-dvh w-full flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-red-500 mb-2">无法进入房间</h2>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <Button
          type="primary"
          block
          loading={missingSession && joining}
          onClick={missingSession ? onJoin : onBack}
          className="rounded-xl"
        >
          {missingSession ? '加入这个房间' : '返回其他房间'}
        </Button>
      </div>
    </div>
  );
}
