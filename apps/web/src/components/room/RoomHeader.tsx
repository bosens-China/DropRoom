import { useState } from 'react';
import { Button, Dropdown, Progress, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  CheckOutlined,
  CopyOutlined,
  EditOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  StopOutlined,
  UserOutlined,
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
  onCopyInviteLink: () => Promise<boolean>;
  onEditRoomName: () => void;
  onDissolve: () => void;
  onExit: () => void;
  /** 移动端打开成员侧栏 */
  onOpenMembers?: () => void;
}

/** 优化后的房间顶栏：彻底解决移动端房间名被挤压截断问题 */
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
  const [copied, setCopied] = useState(false);
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

  const handleCopy = async () => {
    if (!(await onCopyInviteLink())) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
    <header className="shrink-0 dr-surface border-b dr-safe-inline dr-safe-top sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-[var(--dr-surface)]/80">
      <div className="px-2.5 sm:px-5 py-2">
        {/* 第一行：房间名（优先空间保证）、修改、房间码复制与控制按钮 */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-4 h-11 sm:h-12">
          {/* 左区：展开按钮、房间名称、修改图标 */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {onOpenMembers && (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={onOpenMembers}
                className="md:hidden shrink-0 text-[var(--dr-text-muted)] !w-8 !h-8 !px-0"
                aria-label="展开成员栏"
                title="展开成员栏"
              />
            )}

            <div className="min-w-0 flex items-center gap-1">
              <h1 className="text-sm sm:text-base font-semibold truncate text-[var(--dr-text)]">
                {room.name}
              </h1>
              {isOwner && (
                <Tooltip title="修改房间名称">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={onEditRoomName}
                    className="text-[var(--dr-text-muted)] hover:text-[var(--dr-primary)] shrink-0 !w-6 !h-6"
                  />
                </Tooltip>
              )}
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--dr-primary-soft)] text-[var(--dr-primary)] shrink-0 ml-1">
                <UserOutlined className="text-[10px]" />
                {memberCount} 人
              </span>
            </div>
          </div>

          {/* 中区：容量与倒计时集成胶囊卡片（仅桌面端与平板 md 及以上展示） */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs shrink-0">
            <Tooltip
              title={`占用容量：${formatFileSize(occupiedSize)} / ${formatFileSize(room.maxFileBytes)}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <Progress
                    percent={occupiedPercent}
                    showInfo={false}
                    size="small"
                    strokeColor={storageColor}
                    railColor="var(--dr-border)"
                  />
                </div>
                <span className="font-mono text-[11px] text-[var(--dr-text-muted)] whitespace-nowrap">
                  {occupiedPercent}%
                </span>
              </div>
            </Tooltip>

            <div className="h-3 w-[1px] bg-[var(--dr-border)]" />

            <RoomCountdownRing room={room} timeLeft={timeLeft} />
          </div>

          {/* 右区：一键复制房间码、退出与解散 */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* 一键复制房间码胶囊按钮 */}
            <Tooltip title="复制邀请链接">
              <Button
                type="default"
                onClick={handleCopy}
                icon={
                  copied ? (
                    <CheckOutlined className="text-emerald-500" />
                  ) : (
                    <CopyOutlined />
                  )
                }
                className={`font-mono text-xs border-[var(--dr-border)] hover:border-[var(--dr-primary)] transition-all !px-2 sm:!px-3 ${
                  copied ? '!border-emerald-500 !text-emerald-600' : ''
                }`}
              >
                <span className="font-mono font-medium text-xs">
                  {formatRoomCode(roomId)}
                </span>
              </Button>
            </Tooltip>

            {/* 退出房间 */}
            <Tooltip title="退出房间">
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={onExit}
                className="text-[var(--dr-text-muted)] hover:text-red-500 rounded-lg !w-8 sm:!w-9 !h-8 sm:!h-9 !px-0 flex items-center justify-center"
                aria-label="退出房间"
              />
            </Tooltip>

            {/* 房主解散选项 */}
            {isOwner && (
              <Dropdown
                menu={{ items: moreItems }}
                trigger={['hover', 'click']}
              >
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  className="text-[var(--dr-text-muted)] rounded-lg !w-8 sm:!w-9 !h-8 sm:!h-9 !px-0 flex items-center justify-center"
                  aria-label="更多操作"
                />
              </Dropdown>
            )}
          </div>
        </div>

        {/* 第二行：移动端专属（在线人数 + 容量占用进度条 + 倒计时卡片） */}
        <div className="md:hidden mt-1 pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--dr-primary-soft)] text-[var(--dr-primary)] shrink-0">
            <UserOutlined className="text-[9px]" />
            {memberCount}人
          </span>

          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <div className="min-w-0 flex-1">
              <Progress
                percent={occupiedPercent}
                showInfo={false}
                size="small"
                strokeColor={storageColor}
                railColor="var(--dr-border)"
              />
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[var(--dr-text-muted)] whitespace-nowrap">
              {formatFileSize(occupiedSize)} /{' '}
              {formatFileSize(room.maxFileBytes)}
            </span>
          </div>

          <div className="shrink-0 border-l border-black/5 dark:border-white/5 pl-1.5">
            <RoomCountdownRing room={room} timeLeft={timeLeft} />
          </div>
        </div>
      </div>
    </header>
  );
}
