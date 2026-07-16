import { Button, Input, Tooltip } from 'antd';
import {
  FileOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { MAX_TEXT_LENGTH } from '../../utils/roomLimits';

interface RoomComposerProps {
  inputText: string;
  isDragging: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onImageSelect: () => void;
  onVideoSelect: () => void;
  onFileSelect: () => void;
}

/** 房间底部输入区：文字 + 文件上传 */
export function RoomComposer({
  inputText,
  isDragging,
  onInputChange,
  onSend,
  onImageSelect,
  onVideoSelect,
  onFileSelect,
}: RoomComposerProps) {
  const canSend = inputText.trim().length > 0;

  return (
    <div className="shrink-0 px-4 sm:px-6 lg:px-8 pb-4 pt-2 bg-slate-50/80 border-t border-slate-100">
      {isDragging && (
        <div className="mb-2 py-3 px-4 rounded-xl bg-blue-50 border border-dashed border-blue-300 flex items-center justify-center gap-2 text-blue-600 text-sm">
          <UploadOutlined />
          <span>释放文件开始上传</span>
        </div>
      )}

      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <Input.TextArea
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onPressEnter={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="输入要共享的文字内容…"
          autoSize={{ minRows: 2, maxRows: 5 }}
          maxLength={MAX_TEXT_LENGTH}
          showCount
          className="border-none! shadow-none! resize-none px-4 pt-3 pb-1 text-sm"
        />

        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div className="flex items-center gap-0.5">
            <Tooltip title="上传图片">
              <Button
                type="text"
                icon={<PictureOutlined />}
                onClick={onImageSelect}
                className="text-slate-500 hover:text-blue-500"
              />
            </Tooltip>
            <Tooltip title="上传视频">
              <Button
                type="text"
                icon={<PlaySquareOutlined />}
                onClick={onVideoSelect}
                className="text-slate-500 hover:text-blue-500"
              />
            </Tooltip>
            <Tooltip title="上传文件">
              <Button
                type="text"
                icon={<FileOutlined />}
                onClick={onFileSelect}
                className="text-slate-500 hover:text-blue-500"
              />
            </Tooltip>
          </div>

          <Button
            type="primary"
            shape="circle"
            icon={<SendOutlined />}
            onClick={onSend}
            disabled={!canSend}
            className="bg-blue-500 hover:bg-blue-600 border-none shadow-sm"
          />
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 mt-2">
        支持断点续传 · 单批 50 个文件 / 500 MB · 房间总容量 2 GB · Enter 发送
      </p>
    </div>
  );
}
