/* eslint-disable react-hooks/set-state-in-effect */
import {
  createFileRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { Button, Drawer, Modal, message } from 'antd';
import { LoadingOutlined, MenuOutlined, TeamOutlined } from '@ant-design/icons';
import { useRoomSync } from '../hooks/useRoomSync';
import { useJoinedRooms } from '../hooks/useJoinedRooms';
import { useRoomAccess } from '../hooks/useRoomAccess';
import { useRoomUploads } from '../hooks/useRoomUploads';
import {
  getNextRoomIdAfterLeave,
  getRoomSession,
  removeJoinedRoom,
  touchJoinedRoom,
} from '../utils/roomRegistry';
import { RoomListPanel } from '../components/room/RoomListPanel';
import { RoomMemberPanel } from '../components/room/RoomMemberPanel';
import { RoomHeader } from '../components/room/RoomHeader';
import { RoomTimeline } from '../components/room/RoomTimeline';
import { RoomComposer } from '../components/room/RoomComposer';
import { JoinRoomModal } from '../components/room/JoinRoomModal';
import { RoomEditModals } from '../components/room/RoomEditModals';
import { RoomAccessError } from '../components/room/RoomAccessError';
import { createRoomConfirmations } from '../components/room/roomConfirmations';
import { formatDuration } from '../utils/format';
import { MAX_TEXT_LENGTH } from '../utils/roomLimits';

export const Route = createFileRoute('/room/$roomId')({
  component: RoomComponent,
});

function RoomComponent() {
  const { roomId } = useParams({ from: '/room/$roomId' });
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const { rooms, refresh } = useJoinedRooms();
  const {
    room,
    onlineMembers,
    error: syncError,
    myId,
    sendMessage,
    uploadFiles,
    cancelUpload,
    deleteFile,
    retryUpload,
    canRetryUpload,
    isUploadingFile,
    renameRoom,
    leaveRoom,
    dissolveRoom,
    changeNickname,
  } = useRoomSync(roomId, messageApi);

  const [inputText, setInputText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);

  useEffect(() => {
    if (room) touchJoinedRoom(roomId);
  }, [roomId, room]);
  useEffect(() => {
    if (room) {
      setRoomNameInput(room.name);
      const me = onlineMembers.find((m) => m.id === myId);
      if (me) setNicknameInput(me.nickname);
    }
  }, [room, onlineMembers, myId]);
  const navigateAfterLeave = useCallback(() => {
    refresh();
    const nextId = getNextRoomIdAfterLeave(roomId);
    if (nextId) {
      navigate({ to: '/room/$roomId', params: { roomId: nextId } });
    } else {
      navigate({ to: '/' });
    }
  }, [roomId, navigate, refresh]);

  const enterRoom = useCallback(
    (nextRoom: { code: string }) => {
      refresh();
      setRoomsDrawerOpen(false);
      navigate({ to: '/room/$roomId', params: { roomId: nextRoom.code } });
    },
    [navigate, refresh],
  );

  const roomAccess = useRoomAccess({
    notify: messageApi,
    onCreated: enterRoom,
    onJoined: enterRoom,
  });

  useEffect(() => {
    if (!room) return;

    const updateTimer = () => {
      const diff = Math.max(
        0,
        Math.floor((Date.parse(room.expiresAt) - Date.now()) / 1000),
      );
      setTimeLeft(diff);
      if (diff <= 0) {
        removeJoinedRoom(roomId);
        messageApi.error('房间已到期并销毁');
        navigateAfterLeave();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room, roomId, messageApi, navigateAfterLeave]);

  const {
    isDragging,
    fileInputRef,
    imageInputRef,
    videoInputRef,
    handleFileChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    selectFile,
    selectImage,
    selectVideo,
  } = useRoomUploads({
    room,
    notify: messageApi,
    uploadFiles,
  });
  const confirmations = createRoomConfirmations({
    roomId,
    room,
    confirm: (options) => {
      modalApi.confirm(options);
    },
    navigateAfterLeave,
    leaveRoom,
    dissolveRoom,
    cancelUpload,
    deleteFile,
  });
  if (syncError) {
    const missingSession = getRoomSession(roomId) === null;
    return (
      <>
        {contextHolder}
        <RoomAccessError
          message={syncError}
          missingSession={missingSession}
          joining={roomAccess.joining}
          onJoin={() => void roomAccess.join(roomId)}
          onBack={navigateAfterLeave}
        />
      </>
    );
  }
  if (!room) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-slate-50">
        <LoadingOutlined className="text-blue-500 text-3xl" />
      </div>
    );
  }
  const handleSendText = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TEXT_LENGTH) {
      messageApi.error(`文字最多 ${MAX_TEXT_LENGTH.toLocaleString()} 字`);
      return;
    }
    if (await sendMessage(trimmed)) setInputText('');
  };

  const handleCopyInvite = () => {
    const inviteUrl = new URL(`/room/${roomId}`, window.location.origin);
    void navigator.clipboard
      .writeText(inviteUrl.toString())
      .then(() => messageApi.success('邀请链接已复制，可粘贴到微信或 QQ'))
      .catch(() => messageApi.error('复制失败，请手动复制浏览器地址'));
  };

  const listPanel = (
    <RoomListPanel
      rooms={rooms}
      activeRoomId={roomId}
      creating={roomAccess.creating}
      onCreateRoom={roomAccess.openCreate}
      onJoinRoom={roomAccess.openJoin}
    />
  );

  const memberPanel = (
    <RoomMemberPanel
      myId={myId}
      members={onlineMembers}
      onEditNickname={() => setIsEditingNick(true)}
    />
  );

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-slate-100">
      {contextHolder}
      {modalContextHolder}

      {timeLeft < 1800 && timeLeft > 300 && (
        <div className="absolute top-0 inset-x-0 z-50 bg-amber-500 text-slate-900 text-center py-1.5 text-xs font-medium">
          房间将于 {formatDuration(timeLeft)} 后销毁，请尽快备份文件
        </div>
      )}

      <Modal
        title="房间即将销毁"
        open={timeLeft <= 300}
        footer={null}
        closable={false}
        centered
      >
        <p className="text-sm text-slate-500 text-center mb-4">
          此房间已达 24 小时存续上限，系统将清除全部内容
        </p>
        <p className="text-3xl font-mono font-bold text-red-500 text-center">
          {formatDuration(timeLeft)}
        </p>
      </Modal>

      <aside className="hidden md:block w-64 lg:w-72 shrink-0 h-full">
        {listPanel}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="md:hidden shrink-0 flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setRoomsDrawerOpen(true)}
            className="text-slate-600"
          />
          <span className="text-xs font-medium text-slate-600 truncate px-2">
            {room.name}
          </span>
          <Button
            type="text"
            icon={<TeamOutlined />}
            onClick={() => setMembersDrawerOpen(true)}
            className="text-slate-600"
          />
        </header>

        <main
          className="flex-1 flex flex-col min-h-0 bg-slate-50"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <RoomHeader
            room={room}
            roomId={roomId}
            myId={myId}
            timeLeft={timeLeft}
            onCopyInvite={handleCopyInvite}
            onEditRoomName={() => setIsEditingName(true)}
            onDissolve={confirmations.dissolve}
            onExit={confirmations.exit}
          />

          <RoomTimeline
            room={room}
            myId={myId}
            onCopyText={(text) => {
              void navigator.clipboard
                .writeText(text)
                .then(() => messageApi.success('已复制'))
                .catch(() => messageApi.error('复制失败，请手动选择文字'));
            }}
            onDeleteFile={confirmations.deleteSharedFile}
            onRetryFile={retryUpload}
            canRetryFile={canRetryUpload}
            isUploadingFile={isUploadingFile}
          />

          <RoomComposer
            inputText={inputText}
            isDragging={isDragging}
            onInputChange={setInputText}
            onSend={handleSendText}
            onImageSelect={selectImage}
            onVideoSelect={selectVideo}
            onFileSelect={selectFile}
          />
        </main>
      </div>

      <aside className="hidden xl:block w-60 shrink-0 h-full">
        {memberPanel}
      </aside>

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

      <Drawer
        title="房间成员"
        placement="right"
        open={membersDrawerOpen}
        onClose={() => setMembersDrawerOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        {memberPanel}
      </Drawer>

      <JoinRoomModal
        open={roomAccess.joinOpen}
        loading={roomAccess.joining}
        lockoutTime={roomAccess.lockoutTime}
        onJoin={roomAccess.join}
        onCancel={roomAccess.closeJoin}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        onChange={handleFileChange}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      <RoomEditModals
        roomNameOpen={isEditingName}
        roomName={roomNameInput}
        nicknameOpen={isEditingNick}
        nickname={nicknameInput}
        onRoomNameChange={setRoomNameInput}
        onNicknameChange={setNicknameInput}
        onSaveRoomName={() => {
          void renameRoom(roomNameInput).then((updated) => {
            if (!updated) return;
            setIsEditingName(false);
            messageApi.success('房间名称已更新');
          });
        }}
        onSaveNickname={() => {
          void changeNickname(nicknameInput).then((updated) => {
            if (!updated) return;
            setIsEditingNick(false);
            messageApi.success('昵称已更新');
          });
        }}
        onCancelRoomName={() => setIsEditingName(false)}
        onCancelNickname={() => setIsEditingNick(false)}
      />
    </div>
  );
}
