import { useState } from 'react';
import { Input, Modal } from 'antd';

interface JoinRoomModalProps {
  open: boolean;
  loading?: boolean;
  lockoutTime?: number;
  onJoin: (code: string) => void;
  onCancel: () => void;
}

/** 加入房间弹窗 */
export function JoinRoomModal({
  open,
  loading = false,
  lockoutTime = 0,
  onJoin,
  onCancel,
}: JoinRoomModalProps) {
  const [roomCode, setRoomCode] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d\s]/g, '');
    const clean = val.replace(/\s+/g, '');
    if (clean.length > 8) return;
    setRoomCode(
      clean.length > 4 ? `${clean.slice(0, 4)} ${clean.slice(4)}` : clean,
    );
  };

  const cleanCode = roomCode.replace(/\s+/g, '');
  const canJoin = cleanCode.length === 8 && lockoutTime <= 0;

  return (
    <Modal
      title="加入房间"
      open={open}
      onOk={() => onJoin(cleanCode)}
      onCancel={onCancel}
      afterOpenChange={(visible) => {
        if (!visible) setRoomCode('');
      }}
      okText={lockoutTime > 0 ? `锁定中 (${lockoutTime}s)` : '加入'}
      cancelText="取消"
      okButtonProps={{ disabled: !canJoin, loading }}
      centered
      destroyOnHidden
    >
      <label
        htmlFor="join-room-code"
        className="block text-sm font-medium text-slate-700 mb-2"
      >
        8 位房间码
      </label>
      <Input
        id="join-room-code"
        placeholder="0000 0000"
        value={roomCode}
        onChange={handleChange}
        onPressEnter={() => {
          if (canJoin && !loading) onJoin(cleanCode);
        }}
        disabled={lockoutTime > 0}
        className="text-center font-mono text-lg h-11"
        size="large"
        autoFocus
      />
      <p className="text-xs text-slate-400 mt-3">
        加入后房间会保留在你的列表中，可随时切换。
      </p>
    </Modal>
  );
}
