import { Button, Grid, Input, Tooltip } from 'antd';
import {
  FileOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ClipboardEventHandler } from 'react';

interface RoomComposerProps {
  inputText: string;
  maxTextLength: number;
  isDragging: boolean;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onImageSelect: () => void;
  onVideoSelect: () => void;
  onFileSelect: () => void;
  onPasteFiles: ClipboardEventHandler<HTMLTextAreaElement>;
}

/** 底部发送区：一体化输入卡片 */
export function RoomComposer({
  inputText,
  maxTextLength,
  isDragging,
  isSending,
  onInputChange,
  onSend,
  onImageSelect,
  onVideoSelect,
  onFileSelect,
  onPasteFiles,
}: RoomComposerProps) {
  const canSend = inputText.trim().length > 0;
  const screens = Grid.useBreakpoint();
  const isDesktop = Boolean(screens.md);

  return (
    <div className="room-composer w-full flex flex-col px-3 sm:px-4 py-3 dr-chat-bg dr-safe-bottom max-md:shrink-0 md:h-full md:min-h-0">
      {isDragging && (
        <div className="mb-2 shrink-0 rounded-lg border border-dashed border-[var(--dr-primary-border)] bg-[var(--dr-primary-soft)] py-2 text-center text-sm text-[var(--dr-primary)]">
          释放文件开始上传
        </div>
      )}

      <div className="room-composer-card dr-surface flex flex-col overflow-hidden rounded-xl border shadow-sm md:min-h-0 md:flex-1">
        <div className="room-composer-input-wrap flex flex-col md:min-h-0 md:flex-1">
          <Input.TextArea
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={onPasteFiles}
            onPressEnter={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                if (!isSending) onSend();
              }
            }}
            placeholder="输入文字，或粘贴、拖放文件到此处…"
            autoSize={isDesktop ? false : { minRows: 2, maxRows: 5 }}
            rows={isDesktop ? 3 : undefined}
            maxLength={maxTextLength}
            className="room-composer-input dr-scrollbar"
          />
        </div>

        <div className="room-composer-toolbar flex shrink-0 items-center justify-between gap-2 border-t border-[var(--dr-border)] px-2 pb-2.5 pt-1">
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip title="上传图片">
              <Button
                type="text"
                icon={<PictureOutlined />}
                onClick={onImageSelect}
                className="room-composer-tool !h-9 !w-9"
              />
            </Tooltip>
            <Tooltip title="上传视频">
              <Button
                type="text"
                icon={<PlaySquareOutlined />}
                onClick={onVideoSelect}
                className="room-composer-tool !h-9 !w-9"
              />
            </Tooltip>
            <Tooltip title="上传文件">
              <Button
                type="text"
                icon={<FileOutlined />}
                onClick={onFileSelect}
                className="room-composer-tool !h-9 !w-9"
              />
            </Tooltip>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden whitespace-nowrap text-[10px] text-[var(--dr-text-muted)] md:inline">
              Enter 发送 · Shift+Enter 换行
            </span>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={onSend}
              loading={isSending}
              disabled={!canSend || isSending}
              className="room-composer-send shrink-0 !px-4"
            >
              {isSending ? '发送中' : '发送'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
