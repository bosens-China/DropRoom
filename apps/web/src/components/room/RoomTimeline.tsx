import type { FileItem, RoomItem, RoomSnapshot } from '@droproom/api/domain';
import { useEffect, useRef } from 'react';
import { Button, Card, Image, Progress, Tooltip } from 'antd';
import {
  CloseCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PictureOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { fileContentUrl } from '../../api/client';
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4">
          <FileTextOutlined className="text-3xl text-slate-300" />
        </div>
        <h3 className="text-sm font-semibold text-slate-500">
          共享内容将显示在这里
        </h3>
        <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
          复制顶部邀请链接发给其他人；当前只有你一人时也可以先上传文件
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {timeline.map((item) => {
          const isMe = item.senderId === myId;
          const time = new Date(item.createdAt).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <article
              key={item.id}
              className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
                isMe ? 'border-blue-100' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-xs font-semibold truncate ${
                      isMe ? 'text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    {item.senderNickname}
                    <span className="text-slate-400 font-normal ml-1">
                      #{item.senderNumberId}
                    </span>
                    {isMe && (
                      <span className="text-slate-400 font-normal ml-1">
                        （我）
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {item.type === 'text' ? '文字' : '文件'}
                  </span>
                </div>
                <time className="text-[10px] text-slate-400 shrink-0">
                  {time}
                </time>
              </div>

              <div className="p-4">
                {item.type === 'text' ? (
                  <div className="group relative">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {item.content}
                    </p>
                    <Tooltip title="复制文字">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => onCopyText(item.content)}
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-slate-400"
                      />
                    </Tooltip>
                  </div>
                ) : item.mimeType.startsWith('image/') ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 max-h-72 flex justify-center">
                      <Image
                        src={fileContentUrl(room.code, item.id, 'inline')}
                        alt={item.name}
                        className="object-contain max-h-72"
                      />
                    </div>
                    <FileActions
                      room={room}
                      file={item}
                      isOwner={isOwner}
                      isMe={isMe}
                      onDelete={onDeleteFile}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                      {item.mimeType.startsWith('video/') ? (
                        <PictureOutlined />
                      ) : (
                        <FileOutlined />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium text-slate-800 truncate"
                        title={item.name}
                      >
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatFileSize(item.size)}
                      </p>
                    </div>
                    <FileActions
                      room={room}
                      file={item}
                      isOwner={isOwner}
                      isMe={isMe}
                      onDelete={onDeleteFile}
                      compact
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {pendingFiles.map((file) => {
          const progress =
            file.size === 0
              ? 0
              : Math.min(
                  100,
                  Math.round((file.uploadedBytes / file.size) * 100),
                );
          const canManage = isOwner || file.senderId === myId;
          const isUploading = isUploadingFile(file.id);
          const canRetry =
            ['uploading', 'failed'].includes(file.status) &&
            file.senderId === myId &&
            canRetryFile(file.id);
          return (
            <Card
              key={file.id}
              className="rounded-2xl border-dashed border-slate-200 bg-slate-50/50"
              styles={{ body: { padding: '16px' } }}
            >
              <div className="flex items-center gap-3 mb-2">
                {file.status === 'uploading' ? (
                  <LoadingOutlined className="text-blue-500" />
                ) : (
                  <CloseCircleOutlined className="text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                {canRetry && (
                  <Tooltip title="继续上传">
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => onRetryFile(file.id)}
                    >
                      继续
                    </Button>
                  </Tooltip>
                )}
                {canManage && (
                  <Tooltip
                    title={
                      file.status === 'uploading' ? '取消上传' : '删除记录'
                    }
                  >
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
                      onClick={() => onDeleteFile(file.id)}
                    />
                  </Tooltip>
                )}
              </div>
              {file.status === 'uploading' && (
                <>
                  <Progress percent={progress} size="small" showInfo={false} />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isUploading
                      ? `上传中 ${progress}%`
                      : canRetry
                        ? `上传已暂停 ${progress}%`
                        : `已上传 ${progress}%，重新选择同一文件可继续`}
                  </p>
                </>
              )}
              {file.status !== 'uploading' && (
                <p className="text-xs text-red-400">
                  {file.status === 'failed'
                    ? canRetry
                      ? '上传失败，可继续上传'
                      : '上传失败，请重新选择文件'
                    : '上传已取消'}
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <div ref={endRef} />
    </div>
  );
}

interface FileActionsProps {
  room: RoomSnapshot;
  file: FileItem;
  isOwner: boolean;
  isMe: boolean;
  onDelete: (id: string) => void;
  compact?: boolean;
}

function FileActions({
  room,
  file,
  isOwner,
  isMe,
  onDelete,
  compact,
}: FileActionsProps) {
  return (
    <div
      className={`flex items-center gap-1 ${compact ? '' : 'justify-end pt-1'}`}
    >
      <Button
        type="primary"
        size="small"
        icon={<DownloadOutlined />}
        href={fileContentUrl(room.code, file.id, 'attachment')}
        className="rounded-lg"
      >
        {!compact && '下载'}
      </Button>
      {(isOwner || isMe) && (
        <Tooltip title="删除">
          <Button
            danger
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onDelete(file.id)}
          />
        </Tooltip>
      )}
    </div>
  );
}
