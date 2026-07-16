import { Input, Modal } from 'antd';

interface RoomEditModalsProps {
  roomNameOpen: boolean;
  roomName: string;
  nicknameOpen: boolean;
  nickname: string;
  onRoomNameChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onSaveRoomName: () => void;
  onSaveNickname: () => void;
  onCancelRoomName: () => void;
  onCancelNickname: () => void;
}

/** 房间名称与个人昵称的编辑弹窗 */
export function RoomEditModals({
  roomNameOpen,
  roomName,
  nicknameOpen,
  nickname,
  onRoomNameChange,
  onNicknameChange,
  onSaveRoomName,
  onSaveNickname,
  onCancelRoomName,
  onCancelNickname,
}: RoomEditModalsProps) {
  return (
    <>
      <Modal
        title="修改房间名称"
        open={roomNameOpen}
        onOk={onSaveRoomName}
        onCancel={onCancelRoomName}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !roomName.trim() }}
        centered
        destroyOnHidden
      >
        <label
          htmlFor="edit-room-name"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          房间名称
        </label>
        <Input
          id="edit-room-name"
          value={roomName}
          onChange={(event) => onRoomNameChange(event.target.value)}
          onPressEnter={onSaveRoomName}
          maxLength={30}
          showCount
        />
      </Modal>

      <Modal
        title="修改昵称"
        open={nicknameOpen}
        onOk={onSaveNickname}
        onCancel={onCancelNickname}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !nickname.trim() }}
        centered
        destroyOnHidden
      >
        <label
          htmlFor="edit-nickname"
          className="block text-sm font-medium text-slate-700 mb-2"
        >
          昵称
        </label>
        <Input
          id="edit-nickname"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          onPressEnter={onSaveNickname}
          maxLength={15}
          showCount
        />
        <p className="text-xs text-slate-400 mt-3">
          昵称仅用于房间内展示，可随时修改。
        </p>
      </Modal>
    </>
  );
}
