import type { FileItem, RoomSnapshot } from '@droproom/api/domain';
import {
  markRoomUnavailable,
  removeJoinedRoom,
} from '../../utils/roomRegistry';

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

/** 多人协作或上传期间离开时需要二次确认 */
export function shouldConfirmRoomExit(room: RoomSnapshot | null) {
  return (
    (room?.onlineMemberCount ?? 0) > 2 ||
    room?.items.some(
      (item) => item.type === 'file' && item.status === 'uploading',
    ) === true
  );
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
    const memberCount = room?.onlineMemberCount ?? 0;
    if (!shouldConfirmRoomExit(room)) {
      void (async () => {
        if (!(await leaveRoom())) return;
        removeJoinedRoom(roomId);
        navigateAfterLeave();
      })();
      return;
    }

    const transfersOwnership =
      room?.ownerMemberId === room?.currentMemberId && memberCount > 1;
    const hasUploadingFile = room?.items.some(
      (item) => item.type === 'file' && item.status === 'uploading',
    );
    confirm({
      title: '退出这个房间？',
      content: [
        hasUploadingFile ? '退出后，正在上传的文件会中断。' : '',
        transfersOwnership
          ? '房主权限会转交给当前在线且最早加入的成员。'
          : memberCount > 2
            ? '房间会从你的列表中移除，但其他成员仍可继续使用。'
            : '',
      ].join(''),
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
      content:
        '房间会立即不可访问；若有正在下载的内容，底层文件最多保留30分钟后清理，其他数据立即清除。',
      okText: '解散房间',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!(await dissolveRoom())) return;
        markRoomUnavailable(roomId, '房间已被房主解散');
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
