import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { RoomSnapshot } from '@droproom/api/domain';
import { message } from 'antd';
import {
  LoginOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { JoinRoomModal } from '../components/room/JoinRoomModal';
import { DropRoomLogo } from '../components/brand/DropRoomLogo';
import { AppSettingsBar } from '../components/layout/AppSettingsBar';
import { useRoomAccess } from '../hooks/useRoomAccess';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const enterRoom = (room: RoomSnapshot) => {
    navigate({ to: '/room/$roomId', params: { roomId: room.code } });
  };

  const roomAccess = useRoomAccess({
    notify: messageApi,
    onCreated: enterRoom,
    onJoined: enterRoom,
  });

  return (
    <div className="min-h-dvh w-full flex flex-col overflow-x-hidden dr-page-bg dr-safe-top">
      {contextHolder}

      <header className="shrink-0 h-14 border-b dr-surface dr-safe-inline">
        <div className="h-full flex items-center justify-between px-5 sm:px-8">
          <DropRoomLogo size="sm" />
          <AppSettingsBar variant="header" />
        </div>
      </header>

      {/* 主操作区 */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--dr-text)] tracking-tight">
            临时文件传输
          </h1>
          <p className="text-sm sm:text-base text-[var(--dr-text-muted)] mt-3 max-w-md mx-auto leading-relaxed">
            无需注册，创建或加入房间即可共享文件与文字
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 w-full max-w-md sm:max-w-lg">
          <ActionCard
            icon={<PlusOutlined className="text-2xl" />}
            title="创建房间"
            description="发起一个新的临时传输空间"
            accent="primary"
            loading={roomAccess.creating}
            onClick={roomAccess.openCreate}
          />
          <ActionCard
            icon={<LoginOutlined className="text-2xl" />}
            title="加入房间"
            description="输入 8 位房间码进入"
            accent="secondary"
            onClick={roomAccess.openJoin}
          />
        </div>

        <div className="mt-10 sm:mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-[var(--dr-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <ThunderboltOutlined />
            即开即用
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SafetyCertificateOutlined />
            无需注册
          </span>
          <span>24 小时自动销毁</span>
        </div>
      </main>

      <p className="shrink-0 text-center text-[11px] text-[var(--dr-text-muted)] pb-6 px-5 dr-safe-bottom dr-safe-inline">
        连续 5 分钟无人在线或达到 24 小时上限后，房间会自动销毁
      </p>

      <JoinRoomModal
        open={roomAccess.joinOpen}
        loading={roomAccess.joining}
        lockoutTime={roomAccess.lockoutTime}
        onJoin={roomAccess.join}
        onCancel={roomAccess.closeJoin}
      />
    </div>
  );
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: 'primary' | 'secondary';
  loading?: boolean;
  onClick: () => void;
}

/** 腾讯会议风格大操作卡片 */
function ActionCard({
  icon,
  title,
  description,
  accent,
  loading,
  onClick,
}: ActionCardProps) {
  const isPrimary = accent === 'primary';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`group flex-1 flex flex-col items-center gap-3.5 px-5 py-7 sm:py-9 rounded-xl border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
        isPrimary
          ? 'bg-[var(--dr-primary)] border-[var(--dr-primary)] text-white shadow-md shadow-blue-100 hover:bg-[var(--dr-primary-hover)] dark:shadow-none'
          : 'dr-surface text-[var(--dr-text)] shadow-sm hover:border-[var(--dr-primary-border)] hover:shadow'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
          isPrimary
            ? 'bg-white/20 text-white'
            : 'bg-[var(--dr-primary-soft)] text-[var(--dr-primary)]'
        }`}
      >
        {icon}
      </div>
      <div className="text-center">
        <p className="text-base font-semibold">{title}</p>
        <p
          className={`text-xs mt-1 leading-relaxed ${
            isPrimary ? 'text-blue-100' : 'text-[var(--dr-text-muted)]'
          }`}
        >
          {description}
        </p>
      </div>
    </button>
  );
}
