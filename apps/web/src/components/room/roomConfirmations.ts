import type { FileItem, RoomSnapshot } from '@droproom/api/domain';
import { removeJoinedRoom } from '../../utils/roomRegistry';

interface ConfirmOptions {
  title: string;
  content: string;
  okText: string;
  cancelText: string;
  okButtonProps?: { danger: boolean };
  onOk: () => void | Promise<void>;
}

interface RoomConfirmationOptions {
  roomId: string;
  room: RoomSnapshot | null;
  confirm: (options: ConfirmOptions) => void;
  navigateAfterLeave: () => void;
  leaveRoom: () => Promise<boolean>;
  dissolveRoom: () => Promise<boolean>;
  cancelUpload: (fileId: string) => Promise<boolean>;
  deleteFile: (fileId: string) => Promise<boolean>;
}

/** 房间内高风险操作的确认文案与后续行为 */
export function createRoomConfirmations({
  roomId,
  room,
  confirm,
  navigateAfterLeave,
  leaveRoom,
  dissolveRoom,
  cancelUpload,
  deleteFile,
}: RoomConfirmationOptions) {
  const exit = () => {
    confirm({
      title: '退出这个房间？',
      content: '房间会从你的列表中移除，但其他成员仍可继续使用。',
      okText: '退出',
      cancelText: '取消',
      onOk: async () => {
        if (!(await leaveRoom())) return;
        removeJoinedRoom(roomId);
        navigateAfterLeave();
      },
    });
  };

  const dissolve = () => {
    confirm({
      title: '立即解散房间？',
      content: '所有文字、文件和房间状态都会被清空，此操作无法撤销。',
      okText: '解散房间',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!(await dissolveRoom())) return;
        removeJoinedRoom(roomId);
        navigateAfterLeave();
      },
    });
  };

  const deleteSharedFile = (fileId: string) => {
    const file = room?.items.find(
      (item): item is FileItem => item.type === 'file' && item.id === fileId,
    );
    if (!file) return;

    confirm({
      title: file.status === 'uploading' ? '取消上传？' : '删除这个文件？',
      content:
        file.status === 'uploading'
          ? `${file.name} 将停止上传并释放预占容量。`
          : `${file.name} 将从房间中永久删除。`,
      okText: file.status === 'uploading' ? '取消上传' : '删除',
      cancelText: '保留',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (file.status === 'uploading') {
          await cancelUpload(fileId);
          return;
        }
        await deleteFile(fileId);
      },
    });
  };

  return { exit, dissolve, deleteSharedFile };
}
