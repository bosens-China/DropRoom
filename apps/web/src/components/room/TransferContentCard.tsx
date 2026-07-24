import { useState, type ReactNode } from 'react';
import { Button, Image, Tooltip } from 'antd';
import type { FileItem, RoomItem, RoomSnapshot } from '@droproom/api/domain';
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import { fileContentUrl } from '../../api/client';
import { formatFileSize } from '../../utils/format';
import { TextFilePreviewModal } from './TextFilePreviewModal';
import { isTextFile } from './textFile';

interface TransferContentCardProps {
  item: RoomItem;
  room: RoomSnapshot;
  myId: string;
  isMe: boolean;
  isOwner: boolean;
  onCopyText: (text: string) => void;
  onDeleteFile: (fileId: string) => void;
}

/** 单条传输内容：头像与气泡顶对齐，时间戳贴气泡边缘 */
export function TransferContentCard({
  item,
  room,
  myId,
  isMe,
  isOwner,
  onCopyText,
  onDeleteFile,
}: TransferContentCardProps) {
  const [textPreviewOpen, setTextPreviewOpen] = useState(false);
  const time = new Date(item.createdAt).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const avatarTip = `${item.senderNickname}${isMe ? '（我）' : ''} · #${item.senderNumberId}`;
  const canDelete = item.type === 'file' && (isOwner || item.senderId === myId);
  const isText = item.type === 'text';
  const textFile = item.type === 'file' && isTextFile(item) ? item : null;

  const avatar = (
    <Tooltip title={avatarTip}>
      <div
        className={`flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-lg text-xs font-semibold text-white ${
          isMe ? 'bg-[var(--dr-primary)]' : 'bg-slate-400 dark:bg-slate-600'
        }`}
      >
        {item.senderNickname.slice(0, 1).toUpperCase()}
      </div>
    </Tooltip>
  );

  const actions = (
    <aside className="flex shrink-0 flex-col gap-0.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
      {isText ? (
        <IconAction label="复制" onClick={() => onCopyText(item.content)}>
          <CopyOutlined />
        </IconAction>
      ) : (
        <>
          <IconAction
            label="下载"
            href={fileContentUrl(room.code, item.id, 'attachment')}
          >
            <DownloadOutlined />
          </IconAction>
          {canDelete && (
            <IconAction
              label="删除"
              danger
              onClick={() => onDeleteFile(item.id)}
            >
              <DeleteOutlined />
            </IconAction>
          )}
        </>
      )}
    </aside>
  );

  const bubble = (
    <div
      className={`shadow-sm ${
        isText
          ? 'min-w-[3.5rem] rounded-2xl border px-3 py-2'
          : 'min-w-0 rounded-xl border p-3'
      } ${isMe ? 'dr-card-me' : 'dr-card-other'}`}
    >
      {isText ? (
        <TextBlock content={item.content} />
      ) : item.mimeType.startsWith('image/') ? (
        <ImageBlock room={room} file={item} />
      ) : (
        <FileBlock
          file={item}
          onPreview={
            textFile === null ? undefined : () => setTextPreviewOpen(true)
          }
        />
      )}
    </div>
  );

  return (
    <>
      <article
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`flex max-w-[min(100%,32rem)] items-start gap-2.5 ${
            isMe ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          {avatar}

          <div
            className={`flex min-w-0 flex-col gap-1 ${
              isMe ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`group flex items-center gap-1 ${
                isMe ? 'flex-row' : 'flex-row-reverse'
              }`}
            >
              {actions}
              {bubble}
            </div>

            <time
              className={`px-0.5 text-[10px] leading-none text-[var(--dr-text-muted)] ${
                isMe ? 'text-right' : 'text-left'
              }`}
            >
              {time}
            </time>
          </div>
        </div>
      </article>

      {textFile !== null && (
        <TextFilePreviewModal
          open={textPreviewOpen}
          roomCode={room.code}
          file={textFile}
          onClose={() => setTextPreviewOpen(false)}
          onCopyText={onCopyText}
        />
      )}
    </>
  );
}

export function TextBlock({ content }: { content: string }) {
  return (
    <p
      tabIndex={0}
      className="dr-scrollbar max-h-64 overflow-y-auto pr-1 text-sm leading-5 whitespace-pre-wrap break-words text-[var(--dr-text)]"
    >
      {content}
    </p>
  );
}

function ImageBlock({ room, file }: { room: RoomSnapshot; file: FileItem }) {
  const inlineUrl = fileContentUrl(room.code, file.id, 'inline');

  return (
    <div className="space-y-2">
      <div className="flex max-h-64 cursor-zoom-in justify-center overflow-hidden rounded-lg bg-black/5">
        <Image
          src={inlineUrl}
          alt={file.name}
          className="max-h-64 object-contain"
        />
      </div>
      <p
        className="max-w-[14rem] truncate text-xs text-[var(--dr-text-muted)] sm:max-w-xs"
        title={file.name}
      >
        {file.name} · {formatFileSize(file.size)}
      </p>
    </div>
  );
}

function FileBlock({
  file,
  onPreview,
}: {
  file: FileItem;
  onPreview?: () => void;
}) {
  const isVideo = file.mimeType.startsWith('video/');
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dr-primary-soft)] text-[var(--dr-primary)]">
        {isVideo ? <PlaySquareOutlined /> : <FileOutlined />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-medium leading-5 text-[var(--dr-text)]"
          title={file.name}
        >
          {file.name}
        </span>
        <span className="block text-[11px] leading-4 text-[var(--dr-text-muted)]">
          {formatFileSize(file.size)}
        </span>
      </span>
    </>
  );

  return onPreview ? (
    <button
      type="button"
      onClick={onPreview}
      title="点击预览文本"
      className="flex min-w-[12rem] cursor-pointer items-center gap-3 text-left"
    >
      {content}
    </button>
  ) : (
    <div className="flex min-w-[12rem] items-center gap-3">{content}</div>
  );
}

function IconAction({
  label,
  children,
  onClick,
  href,
  danger,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  if (href) {
    return (
      <Tooltip title={label}>
        <Button
          type="text"
          size="small"
          icon={children}
          href={href}
          className={`!h-8 !w-8 ${danger ? '' : 'text-[var(--dr-primary)]'}`}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={label}>
      <Button
        type="text"
        size="small"
        icon={children}
        onClick={onClick}
        danger={danger}
        className="!h-8 !w-8"
      />
    </Tooltip>
  );
}
