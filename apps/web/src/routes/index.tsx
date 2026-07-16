import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { RoomSnapshot } from '@droproom/api/domain';
import { useState } from 'react';
import { Button, Drawer, Input, Modal, message } from 'antd';
import {
  ArrowRightOutlined,
  EditOutlined,
  LoginOutlined,
  MenuOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { JoinRoomModal } from '../components/room/JoinRoomModal';
import { RoomListPanel } from '../components/room/RoomListPanel';
import { DropRoomLogo } from '../components/brand/DropRoomLogo';
import { useJoinedRooms } from '../hooks/useJoinedRooms';
import { useRoomAccess } from '../hooks/useRoomAccess';
import { getMyNickname, setMyNickname } from '../utils/preferences';
import { formatRoomCode } from '../utils/format';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { rooms, refresh } = useJoinedRooms();
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nickname, setNickname] = useState(getMyNickname);
  const [nicknameInput, setNicknameInput] = useState(getMyNickname);

  const enterRoom = (room: RoomSnapshot) => {
    refresh();
    setRoomsDrawerOpen(false);
    navigate({ to: '/room/$roomId', params: { roomId: room.code } });
  };

  const roomAccess = useRoomAccess({
    notify: messageApi,
    onCreated: enterRoom,
    onJoined: enterRoom,
  });

  const activeRooms = rooms.filter(
    (summary): summary is typeof summary & { room: RoomSnapshot } =>
      summary.room !== null,
  );
  const listPanel = (
    <RoomListPanel
      rooms={rooms}
      activeRoomId=""
      creating={roomAccess.creating}
      onCreateRoom={roomAccess.openCreate}
      onJoinRoom={roomAccess.openJoin}
    />
  );

  const openNicknameEditor = () => {
    setNicknameInput(nickname);
    setNicknameOpen(true);
  };

  const saveNickname = () => {
    const nextNickname = nicknameInput.trim();
    if (!nextNickname) {
      messageApi.error('昵称不能为空');
      return;
    }

    setMyNickname(nextNickname);
    setNickname(nextNickname);
    setNicknameOpen(false);
    messageApi.success('昵称已更新');
  };

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-slate-100">
      {contextHolder}

      <aside className="hidden md:block w-64 lg:w-72 shrink-0 h-full">
        {listPanel}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col bg-white">
        <header className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <DropRoomLogo size="sm" />
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setRoomsDrawerOpen(true)}
            aria-label="打开房间列表"
          />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-12">
            <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-7 sm:px-9 sm:py-9 text-white shadow-lg shadow-blue-100">
              <p className="text-xs font-semibold text-blue-100 tracking-wider">
                多房间工作台
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-2">
                选择房间，继续共享
              </h1>
              <p className="text-sm text-blue-100 mt-3 max-w-2xl leading-relaxed">
                你可以同时保留多个临时房间，在房间列表中快速切换。每个房间的内容和生命周期彼此独立。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={roomAccess.openCreate}
                  loading={roomAccess.creating}
                  className="rounded-xl border-none font-medium"
                >
                  创建房间
                </Button>
                <Button
                  ghost
                  size="large"
                  icon={<LoginOutlined />}
                  onClick={roomAccess.openJoin}
                  className="rounded-xl font-medium"
                >
                  加入房间
                </Button>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">我的房间</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    已保留 {activeRooms.length} 个房间，最近访问的排在前面
                  </p>
                </div>
                <Button
                  className="md:hidden rounded-xl"
                  onClick={() => setRoomsDrawerOpen(true)}
                >
                  查看全部
                </Button>
              </div>

              {activeRooms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    还没有加入任何房间
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    创建一个新房间，或使用他人分享的 8 位房间码加入。
                  </p>
                  <div className="flex justify-center gap-2 mt-5">
                    <Button type="primary" onClick={roomAccess.openCreate}>
                      创建房间
                    </Button>
                    <Button onClick={roomAccess.openJoin}>加入房间</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {activeRooms.slice(0, 6).map(({ entry, room }) => (
                    <button
                      key={entry.roomId}
                      type="button"
                      onClick={() => enterRoom(room)}
                      className="group text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {room.name}
                          </p>
                          <p className="text-xs font-mono text-slate-400 mt-1">
                            {formatRoomCode(room.code)}
                          </p>
                        </div>
                        <ArrowRightOutlined className="text-slate-300 group-hover:text-blue-500 mt-1" />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-4">
                        最近访问：
                        {new Date(entry.lastVisitedAt).toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  {nickname.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">当前昵称</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {nickname}
                  </p>
                </div>
              </div>
              <Button icon={<EditOutlined />} onClick={openNicknameEditor}>
                修改
              </Button>
            </section>

            <p className="text-center text-xs text-slate-400 mt-8">
              连续 5 分钟无人在线或达到 24 小时上限后，房间会自动销毁。
            </p>
          </div>
        </main>
      </div>

      <Drawer
        title="我的房间"
        placement="left"
        open={roomsDrawerOpen}
        onClose={() => setRoomsDrawerOpen(false)}
        width={300}
        styles={{ body: { padding: 0 } }}
      >
        {listPanel}
      </Drawer>

      <JoinRoomModal
        open={roomAccess.joinOpen}
        loading={roomAccess.joining}
        lockoutTime={roomAccess.lockoutTime}
        onJoin={roomAccess.join}
        onCancel={roomAccess.closeJoin}
      />

      <Modal
        title="修改昵称"
        open={nicknameOpen}
        onOk={saveNickname}
        onCancel={() => setNicknameOpen(false)}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !nicknameInput.trim() }}
        centered
      >
        <label
          htmlFor="home-nickname"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          昵称
        </label>
        <Input
          id="home-nickname"
          value={nicknameInput}
          onChange={(event) => setNicknameInput(event.target.value)}
          onPressEnter={saveNickname}
          maxLength={15}
          showCount
          autoFocus
        />
        <p className="text-xs text-slate-400 mt-3">
          昵称保存在当前浏览器，并展示给房间成员。
        </p>
      </Modal>
    </div>
  );
}
