import { Button, Tooltip } from 'antd';
import { CopyOutlined, EditOutlined, LogoutOutlined } from '@ant-design/icons';
import type { RoomSnapshot } from '@droproom/api/domain';
import {
  formatDuration,
  formatFileSize,
  formatRoomCode,
} from '../../utils/format';

interface RoomHeaderProps {
  room: RoomSnapshot;
  roomId: string;
  myId: string;
  timeLeft: number;
  onCopyInvite: () => void;
  onEditRoomName: () => void;
  onDissolve: () => void;
  onExit: () => void;
}

/** 当前房间顶部信息：名称、房间码、容量、倒计时 */
export function RoomHeader({
  room,
  roomId,
  myId,
  timeLeft,
  onCopyInvite,
  onEditRoomName,
  onDissolve,
  onExit,
}: RoomHeaderProps) {
  const isOwner = room.ownerMemberId === myId;
  const usedPercent = Math.min(100, (room.usedBytes / room.maxFileBytes) * 100);
  const occupiedPercent = Math.min(
    100,
    (room.reservedBytes / room.maxFileBytes) * 100,
  );
  const remainingSize = Math.max(
    0,
    room.maxFileBytes - room.usedBytes - room.reservedBytes,
  );

  return (
    <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-3 bg-white border-b border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* 房间名称与码 */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate">
              {room.name}
            </h1>
            {isOwner && (
              <Tooltip title="修改房间名称">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={onEditRoomName}
                  className="text-slate-400 shrink-0"
                />
              </Tooltip>
            )}
          </div>
          <button
            type="button"
            onClick={onCopyInvite}
            title="复制邀请链接"
            className="flex items-center gap-1.5 mt-0.5 border-none bg-transparent p-0 cursor-pointer group"
          >
            <span className="text-xs text-slate-400 font-mono group-hover:text-blue-500 transition-colors">
              {formatRoomCode(roomId)}
            </span>
            <CopyOutlined className="text-[10px] text-slate-300 group-hover:text-blue-400" />
          </button>
        </div>

        {/* 房间级状态：容量 + 倒计时 */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <div className="min-w-[160px]">
            <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1">
              <span>已用 {formatFileSize(room.usedBytes)}</span>
              <span>剩余 {formatFileSize(remainingSize)}</span>
            </div>
            <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                style={{ width: `${usedPercent}%` }}
              />
              <div
                className="absolute inset-y-0 bg-amber-400 rounded-full"
                style={{
                  left: `${usedPercent}%`,
                  width: `${occupiedPercent}%`,
                }}
              />
            </div>
            {room.reservedBytes > 0 && (
              <p className="text-[10px] text-amber-500 mt-1">
                上传中预占 {formatFileSize(room.reservedBytes)}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400">存续倒计时</div>
            <div
              className={`text-sm font-mono font-bold ${
                timeLeft < 300
                  ? 'text-red-500'
                  : timeLeft < 1800
                    ? 'text-amber-500'
                    : 'text-slate-700'
              }`}
            >
              {formatDuration(timeLeft)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="small"
              icon={<LogoutOutlined />}
              onClick={onExit}
              className="rounded-lg text-xs"
            >
              退出
            </Button>
            {isOwner && (
              <Button
                danger
                size="small"
                onClick={onDissolve}
                className="rounded-lg text-xs"
              >
                解散
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
