import { Button, Tooltip } from 'antd';
import { LoginOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import type { JoinedRoomSummary } from '../../utils/roomRegistry';
import { DropRoomLogo } from '../brand/DropRoomLogo';
import { formatRoomCode } from '../../utils/format';

interface RoomListPanelProps {
  rooms: JoinedRoomSummary[];
  activeRoomId: string;
  creating: boolean;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

/** 左侧房间列表面板 */
export function RoomListPanel({
  rooms,
  activeRoomId,
  creating,
  onCreateRoom,
  onJoinRoom,
}: RoomListPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200/80">
      {/* 品牌 */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          aria-label="返回多房间工作台"
          className="border-none bg-transparent p-0 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <DropRoomLogo size="sm" />
        </button>
      </div>

      {/* 创建 / 加入 */}
      <div className="px-3 pb-3 flex gap-2 shrink-0">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={creating}
          onClick={onCreateRoom}
          className="flex-1 rounded-xl h-9 text-xs font-medium"
        >
          创建
        </Button>
        <Button
          icon={<LoginOutlined />}
          onClick={onJoinRoom}
          className="flex-1 rounded-xl h-9 text-xs"
        >
          加入
        </Button>
      </div>

      {/* 房间列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {rooms.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              还没有加入任何房间
              <br />
              点击上方创建或加入
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {rooms.map(({ entry, room }) => {
              const isActive = entry.roomId === activeRoomId;
              const isExpired = !room;

              return (
                <button
                  key={entry.roomId}
                  type="button"
                  disabled={isExpired}
                  onClick={() =>
                    navigate({
                      to: '/room/$roomId',
                      params: { roomId: entry.roomId },
                    })
                  }
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border ${
                    isActive
                      ? 'bg-white border-blue-200 shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-white/70'
                  } ${isExpired ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isActive ? 'text-blue-600' : 'text-slate-700'
                      }`}
                    >
                      {room?.name ?? '已失效房间'}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {formatRoomCode(entry.roomId)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-3 border-t border-slate-200/60 shrink-0">
        <Tooltip title="可同时加入多个房间，在列表间切换">
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            已加入 {rooms.filter((r) => r.room).length} 个房间
          </p>
        </Tooltip>
      </div>
    </div>
  );
}
