import type { FileItem, RoomItem, RoomSnapshot } from '@droproom/api/domain';
import { useEffect, useRef } from 'react';
import { Button, Progress } from 'antd';
import {
  CloseCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  FileOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { TransferContentCard } from './TransferContentCard';
import { formatFileSize } from '../../utils/format';

interface RoomTimelineProps {
  room: RoomSnapshot;
  myId: string;
  onCopyText: (text: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRetryFile: (fileId: string) => void;
  canRetryFile: (fileId: string) => boolean;
  isUploadingFile: (fileId: string) => boolean;
}

function visibleTimeline(items: RoomItem[]): RoomItem[] {
  return items
    .filter((item) => item.type === 'text' || item.status === 'ready')
    .sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );
}

/** 文件传输助手风格内容时间线 */
export function RoomTimeline({
  room,
  myId,
  onCopyText,
  onDeleteFile,
  onRetryFile,
  canRetryFile,
  isUploadingFile,
}: RoomTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const timeline = visibleTimeline(room.items);
  const pendingFiles = room.items.filter(
    (item): item is FileItem =>
      item.type === 'file' && !['ready', 'deleted'].includes(item.status),
  );
  const isOwner = room.ownerMemberId === myId;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length, pendingFiles.length]);

  if (timeline.length === 0 && pendingFiles.length === 0) {
    return (
      <div className="room-timeline-scroll flex min-h-0 flex-1 flex-col items-center justify-center py-12 text-center dr-chat-bg">
        <div className="w-16 h-16 rounded-2xl dr-surface border shadow-sm flex items-center justify-center mb-4">
          <FileOutlined className="text-2xl text-[var(--dr-text-muted)]" />
        </div>
        <h3 className="text-sm font-medium text-[var(--dr-text-muted)]">
          开始共享内容
        </h3>
        <p className="text-xs text-[var(--dr-text-muted)] mt-2 max-w-xs leading-relaxed px-4">
          发送文字或上传文件，邀请他人加入房间一起传输
        </p>
      </div>
    );
  }

  return (
    <div className="room-timeline-scroll dr-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-4 dr-chat-bg">
      <div className="space-y-5 px-4">
        {timeline.map((item) => (
          <TransferContentCard
            key={item.id}
            item={item}
            room={room}
            myId={myId}
            isMe={item.senderId === myId}
            isOwner={isOwner}
            onCopyText={onCopyText}
            onDeleteFile={onDeleteFile}
          />
        ))}

        {pendingFiles.map((file) => (
          <PendingFileCard
            key={file.id}
            file={file}
            isOwner={isOwner}
            myId={myId}
            isUploading={isUploadingFile(file.id)}
            canRetry={canRetryFile(file.id)}
            onRetry={onRetryFile}
            onDelete={onDeleteFile}
          />
        ))}
      </div>
      <div ref={endRef} />
    </div>
  );
}

interface PendingFileCardProps {
  file: FileItem;
  isOwner: boolean;
  myId: string;
  isUploading: boolean;
  canRetry: boolean;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

function PendingFileCard({
  file,
  isOwner,
  myId,
  isUploading,
  canRetry,
  onRetry,
  onDelete,
}: PendingFileCardProps) {
  const progress =
    file.size === 0
      ? 0
      : Math.min(100, Math.round((file.uploadedBytes / file.size) * 100));
  const canManage = isOwner || file.senderId === myId;
  const showRetry =
    ['uploading', 'failed'].includes(file.status) &&
    file.senderId === myId &&
    canRetry;

  const isMe = file.senderId === myId;

  return (
    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-md dr-surface rounded-xl px-4 py-3 border border-dashed">
        <div className="flex items-center gap-2 mb-2">
          {file.status === 'uploading' ? (
            <LoadingOutlined className="text-[var(--dr-primary)]" />
          ) : (
            <CloseCircleOutlined className="text-red-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-[11px] text-[var(--dr-text-muted)]">
              {formatFileSize(file.size)}
            </p>
          </div>
          {showRetry && (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => onRetry(file.id)}
            >
              继续
            </Button>
          )}
          {canManage && (
            <Button
              type="text"
              size="small"
              icon={
                file.status === 'uploading' ? (
                  <CloseOutlined />
                ) : (
                  <DeleteOutlined />
                )
              }
              onClick={() => onDelete(file.id)}
            />
          )}
        </div>
        {file.status === 'uploading' && (
          <>
            <Progress percent={progress} size="small" showInfo={false} />
            <p className="text-[10px] text-[var(--dr-text-muted)] mt-1">
              {isUploading
                ? `上传中 ${progress}%`
                : showRetry
                  ? `上传已暂停 ${progress}%`
                  : `已上传 ${progress}%`}
            </p>
          </>
        )}
        {file.status !== 'uploading' && (
          <p className="text-xs text-red-400">
            {file.status === 'failed'
              ? showRetry
                ? '上传失败，可继续上传'
                : '上传失败，请重新选择文件'
              : '上传已取消'}
          </p>
        )}
      </div>
    </div>
  );
}
