import { Button, Tooltip } from 'antd';
import type { MemberView } from '@droproom/api/domain';
import {
  CrownOutlined,
  EditOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
interface RoomMemberPanelProps {
  myId: string;
  members: MemberView[];
  onEditNickname: () => void;
}

/** 右侧成员面板 */
export function RoomMemberPanel({
  myId,
  members,
  onEditNickname,
}: RoomMemberPanelProps) {
  const sorted = [...members].sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    if (a.id === myId) return -1;
    if (b.id === myId) return 1;
    return a.nickname.localeCompare(b.nickname);
  });

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200/80">
      <div className="px-4 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <TeamOutlined className="text-slate-400" />
          <span>房间成员</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          当前 {members.length} 人在线
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {sorted.map((member) => {
          const isMe = member.id === myId;
          const isOwner = member.isOwner;

          return (
            <div
              key={member.id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <UserOutlined />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-700 truncate font-medium">
                    {member.nickname}
                  </span>
                  {isMe && (
                    <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded shrink-0">
                      我
                    </span>
                  )}
                  {isOwner && (
                    <Tooltip title="房主">
                      <CrownOutlined className="text-amber-500 text-[10px] shrink-0" />
                    </Tooltip>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">在线</span>
                <span className="text-[10px] text-slate-300 ml-1">
                  #{member.numberId}
                </span>
              </div>

              {isMe && (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={onEditNickname}
                  className="text-slate-400 shrink-0"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
