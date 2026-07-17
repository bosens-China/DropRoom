import { Button, Dropdown, Progress, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  CopyOutlined,
  EditOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { RoomSnapshot } from '@droproom/api/domain';
import { DR_PRIMARY } from '../../constants/theme';
import { formatFileSize, formatRoomCode } from '../../utils/format';
import { RoomCountdownRing } from './RoomCountdownRing';

interface RoomHeaderProps {
  room: RoomSnapshot;
  roomId: string;
  myId: string;
  timeLeft: number;
  memberCount: number;
  onCopyInviteLink: () => void;
  onEditRoomName: () => void;
  onDissolve: () => void;
  onExit: () => void;
  /** 移动端打开成员侧栏 */
  onOpenMembers?: () => void;
}

/** 房间顶栏：名称、房间码、剩余空间、圆环倒计时 */
export function RoomHeader({
  room,
  roomId,
  myId,
  timeLeft,
  memberCount,
  onCopyInviteLink,
  onEditRoomName,
  onDissolve,
  onExit,
  onOpenMembers,
}: RoomHeaderProps) {
  const isOwner = room.ownerMemberId === myId;
  const occupiedSize = Math.min(
    room.maxFileBytes,
    room.usedBytes + room.reservedBytes,
  );
  const occupiedPercent = Math.round((occupiedSize / room.maxFileBytes) * 100);

  const storageColor =
    occupiedPercent < 70
      ? DR_PRIMARY
      : occupiedPercent < 90
        ? '#faad14'
        : '#ff4d4f';

  const moreItems: MenuProps['items'] = isOwner
    ? [
        {
          key: 'dissolve',
          icon: <StopOutlined />,
          label: '解散房间',
          danger: true,
          onClick: onDissolve,
        },
      ]
    : [];

  return (
    <div className="shrink-0 dr-surface border-b dr-safe-inline dr-safe-top">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenMembers && (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={onOpenMembers}
              className="md:hidden shrink-0 text-[var(--dr-text-muted)] !w-9 !h-9"
              aria-label="展开成员栏"
              title="展开成员栏"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-semibold truncate">
                {room.name}
              </h1>
              {isOwner && (
                <Tooltip title="修改房间名称">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={onEditRoomName}
                    className="text-[var(--dr-text-muted)] shrink-0 !w-7 !h-7"
                  />
                </Tooltip>
              )}
              <span className="text-[11px] text-[var(--dr-text-muted)] shrink-0">
                {memberCount} 人
              </span>
            </div>
            <button
              type="button"
              onClick={onCopyInviteLink}
              title="复制邀请链接"
              aria-label={`复制房间 ${formatRoomCode(roomId)} 的邀请链接`}
              className="flex items-center gap-1 mt-0.5 border-none bg-transparent p-0 cursor-pointer group"
            >
              <span className="text-[11px] text-[var(--dr-text-muted)] font-mono group-hover:text-[var(--dr-primary)] transition-colors">
                {formatRoomCode(roomId)}
              </span>
              <CopyOutlined className="text-[9px] text-[var(--dr-text-muted)] group-hover:text-[var(--dr-primary)]" />
            </button>
          </div>

          <div className="hidden sm:flex w-44 lg:w-56 shrink-0 items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <Progress
                percent={occupiedPercent}
                showInfo={false}
                size="small"
                strokeColor={storageColor}
                trailColor="var(--dr-border)"
              />
            </div>
            <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-[var(--dr-text-muted)]">
              {formatFileSize(occupiedSize)} /{' '}
              {formatFileSize(room.maxFileBytes)}
            </span>
          </div>

          <RoomCountdownRing room={room} timeLeft={timeLeft} />

          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={onExit}
            className="shrink-0 rounded-xl text-[var(--dr-text-muted)] hover:text-[var(--dr-primary)] !h-10 !px-2.5 sm:!px-3"
          >
            <span className="hidden sm:inline">退出</span>
          </Button>

          {isOwner && (
            <Dropdown menu={{ items: moreItems }} trigger={['hover', 'click']}>
              <Button
                type="text"
                icon={<MoreOutlined />}
                className="text-[var(--dr-text-muted)] shrink-0 rounded-xl !w-10 !h-10"
                aria-label="更多操作"
              />
            </Dropdown>
          )}
        </div>

        {/* 移动端：容量占用进度 */}
        <div className="sm:hidden mt-2 flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <Progress
              percent={occupiedPercent}
              showInfo={false}
              size="small"
              strokeColor={storageColor}
              trailColor="var(--dr-border)"
            />
          </div>
          <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-[var(--dr-text-muted)]">
            {formatFileSize(occupiedSize)} / {formatFileSize(room.maxFileBytes)}
          </span>
        </div>
      </div>
    </div>
  );
}
