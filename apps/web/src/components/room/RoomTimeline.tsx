import type { FileItem, RoomSnapshot } from '@droproom/api/domain';
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
import type { UploadViewState } from '../../utils/fileUpload';
import { chronologicalTimeline } from './timelineOrder';

interface RoomTimelineProps {
  room: RoomSnapshot;
  myId: string;
  onCopyText: (text: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRetryFile: (fileId: string) => void;
  canRetryFile: (fileId: string) => boolean;
  uploadStateForFile: (fileId: string) => UploadViewState | undefined;
}

/** 文件传输助手风格内容时间线 */
export function RoomTimeline({
  room,
  myId,
  onCopyText,
  onDeleteFile,
  onRetryFile,
  canRetryFile,
  uploadStateForFile,
}: RoomTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const timeline = chronologicalTimeline(room.items);
  const isOwner = room.ownerMemberId === myId;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  if (timeline.length === 0) {
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
        {timeline.map((item) =>
          item.type === 'file' && item.status !== 'ready' ? (
            <PendingFileCard
              key={item.id}
              file={item}
              isOwner={isOwner}
              myId={myId}
              uploadState={uploadStateForFile(item.id)}
              canRetry={canRetryFile(item.id)}
              onRetry={onRetryFile}
              onDelete={onDeleteFile}
            />
          ) : (
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
          ),
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
}

interface PendingFileCardProps {
  file: FileItem;
  isOwner: boolean;
  myId: string;
  uploadState?: UploadViewState;
  canRetry: boolean;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

function PendingFileCard({
  file,
  isOwner,
  myId,
  uploadState,
  canRetry,
  onRetry,
  onDelete,
}: PendingFileCardProps) {
  const uploadedBytes =
    uploadState?.stage === 'uploading'
      ? uploadState.uploadedBytes + uploadState.chunkUploadedBytes
      : (uploadState?.uploadedBytes ?? file.uploadedBytes);
  const progress =
    file.size === 0
      ? 0
      : Math.min(100, Math.round((uploadedBytes / file.size) * 100));
  const chunkProgress =
    uploadState?.chunkBytes && uploadState.stage === 'uploading'
      ? Math.min(
          100,
          Math.round(
            (uploadState.chunkUploadedBytes / uploadState.chunkBytes) * 100,
          ),
        )
      : 0;
  const canManage =
    file.status !== 'deleted' && (isOwner || file.senderId === myId);
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
              {uploadState?.stage === 'queued'
                ? `排队中，已上传 ${progress}%`
                : uploadState?.stage === 'uploading'
                  ? `上传中 ${progress}%`
                  : uploadState?.stage === 'paused' || showRetry
                    ? `上传已暂停 ${progress}%`
                    : `已上传 ${progress}%`}
            </p>
            {file.size > file.chunkSize &&
              uploadState?.stage === 'uploading' && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-[10px] text-[var(--dr-text-muted)]">
                    <span>当前分片</span>
                    <span>{chunkProgress}%</span>
                  </div>
                  <Progress
                    percent={chunkProgress}
                    size="small"
                    showInfo={false}
                    strokeColor="var(--dr-primary)"
                    railColor="var(--dr-border)"
                  />
                </div>
              )}
          </>
        )}
        {file.status !== 'uploading' && (
          <p
            className={`text-xs ${file.status === 'deleted' ? 'text-[var(--dr-text-muted)]' : 'text-red-400'}`}
          >
            {file.status === 'deleted'
              ? '文件已删除或不可用'
              : file.status === 'failed'
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
