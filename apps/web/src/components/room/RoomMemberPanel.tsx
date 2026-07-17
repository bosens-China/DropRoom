import { Button, Tooltip } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import type { MemberView } from '@droproom/api/domain';
import {
  CrownOutlined,
  EditOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { DropRoomLogo } from '../brand/DropRoomLogo';
import { AppSettingsBar } from '../layout/AppSettingsBar';

interface RoomMemberPanelProps {
  myId: string;
  members: MemberView[];
  onEditNickname: () => void;
  onSaveNickname: (nickname: string) => Promise<boolean>;
}

/** QQ 风格左侧栏：品牌 + 成员 + 设置 */
export function RoomMemberPanel({
  myId,
  members,
  onEditNickname,
  onSaveNickname,
}: RoomMemberPanelProps) {
  const navigate = useNavigate();
  const me = members.find((member) => member.id === myId);
  const sorted = [...members].sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    if (a.id === myId) return -1;
    if (b.id === myId) return 1;
    return a.nickname.localeCompare(b.nickname);
  });

  return (
    <div className="flex flex-col h-full w-full dr-sidebar border-r">
      {/* 品牌 Logo */}
      <div className="shrink-0 px-4 py-3.5 border-b border-[var(--dr-border)]">
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          aria-label="返回首页"
          className="border-none bg-transparent p-0 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <DropRoomLogo size="sm" />
        </button>
      </div>

      {/* 成员标题 */}
      <div className="px-4 py-2.5 border-b border-[var(--dr-border)] shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TeamOutlined className="text-[#006EFF]" />
          <span>成员</span>
          <span className="text-xs font-normal text-[var(--dr-text-muted)]">
            {members.length} 人在线
          </span>
        </div>
      </div>

      {/* 成员列表：独立滚动，Logo / 标题 / 设置固定 */}
      <div className="room-member-scroll dr-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1">
        {sorted.map((member) => {
          const isMe = member.id === myId;
          const isOwner = member.isOwner;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              <div className="relative shrink-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold ${
                    isMe ? 'bg-[#006EFF]' : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                >
                  {member.nickname.slice(0, 1).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[var(--dr-bg-sidebar)] bg-emerald-500" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm truncate font-medium">
                    {member.nickname}
                  </span>
                  {isOwner && (
                    <Tooltip title="房主">
                      <CrownOutlined className="text-amber-500 text-[10px] shrink-0" />
                    </Tooltip>
                  )}
                </div>
                <span className="text-[11px] text-[var(--dr-text-muted)]">
                  {isMe ? '我' : '在线'} · #{member.numberId}
                </span>
              </div>

              {isMe && (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={onEditNickname}
                  className="text-[var(--dr-text-muted)] shrink-0"
                />
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="px-4 py-8 text-center">
            <UserOutlined className="text-2xl text-[var(--dr-text-muted)]" />
            <p className="text-xs text-[var(--dr-text-muted)] mt-2">
              暂无在线成员
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <AppSettingsBar
          variant="embedded"
          nickname={me?.nickname}
          onNicknameSave={onSaveNickname}
        />
      </div>
    </div>
  );
}
