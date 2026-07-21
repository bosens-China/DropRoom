import {
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type RefObject,
} from 'react';
import type { RoomSnapshot } from '@droproom/api/domain';
import { formatFileSize } from '../utils/format';

interface UploadNotifier {
  error: (content: string) => void;
}

interface UseRoomUploadsOptions {
  room: RoomSnapshot | null;
  notify: UploadNotifier;
  uploadFiles: (files: File[]) => Promise<boolean>;
}

/** 文件选择、粘贴、拖放和批次前置校验 */
export function useRoomUploads({
  room,
  notify,
  uploadFiles,
}: UseRoomUploadsOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const submitFiles = (files: File[]) => {
    if (!room || !files.length) return;
    const supportedFiles = files.filter((file) => file.size > 0);
    if (supportedFiles.length !== files.length) {
      notify.error('暂不支持上传空文件');
    }
    if (!supportedFiles.length) return;
    if (supportedFiles.length > room.maxFilesPerBatch) {
      notify.error(`单次最多选择 ${room.maxFilesPerBatch} 个文件`);
      return;
    }

    const batchSize = supportedFiles.reduce(
      (total, file) => total + file.size,
      0,
    );
    if (batchSize > room.maxBatchBytes) {
      notify.error(
        `单批文件总大小不能超过 ${formatFileSize(room.maxBatchBytes)}`,
      );
      return;
    }

    const availableSize = Math.max(
      0,
      room.maxFileBytes - room.usedBytes - room.reservedBytes,
    );
    if (batchSize > availableSize) {
      notify.error(
        `房间剩余容量仅 ${formatFileSize(availableSize)}，本批需要 ${formatFileSize(batchSize)}`,
      );
      return;
    }

    void uploadFiles(supportedFiles);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    submitFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    submitFiles(Array.from(event.dataTransfer.files));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (!files.length) return;
    event.preventDefault();
    submitFiles(files);
  };

  const openPicker = (inputRef: RefObject<HTMLInputElement | null>) => {
    inputRef.current?.click();
  };

  return {
    isDragging,
    fileInputRef,
    imageInputRef,
    videoInputRef,
    handleFileChange,
    handleDrop,
    handlePaste,
    handleDragOver: (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    },
    handleDragLeave: () => setIsDragging(false),
    selectFile: () => openPicker(fileInputRef),
    selectImage: () => openPicker(imageInputRef),
    selectVideo: () => openPicker(videoInputRef),
  };
}
