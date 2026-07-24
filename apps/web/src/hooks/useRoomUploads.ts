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

const UNTITLED_TEXT_FILE_PATTERN = /^无标题文件(\d+)\.txt$/;

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
  const nextUntitledTextFileNumberRef = useRef(1);

  const submitFiles = async (files: File[]) => {
    if (!room || !files.length) return false;
    const supportedFiles = files.filter((file) => file.size > 0);
    if (supportedFiles.length !== files.length) {
      notify.error('暂不支持上传空文件');
    }
    if (!supportedFiles.length) return false;
    if (supportedFiles.length > room.maxFilesPerBatch) {
      notify.error(`单次最多选择 ${room.maxFilesPerBatch} 个文件`);
      return false;
    }

    const batchSize = supportedFiles.reduce(
      (total, file) => total + file.size,
      0,
    );
    if (batchSize > room.maxBatchBytes) {
      notify.error(
        `单批文件总大小不能超过 ${formatFileSize(room.maxBatchBytes)}`,
      );
      return false;
    }

    const availableSize = Math.max(
      0,
      room.maxFileBytes - room.usedBytes - room.reservedBytes,
    );
    if (batchSize > availableSize) {
      notify.error(
        `房间剩余容量仅 ${formatFileSize(availableSize)}，本批需要 ${formatFileSize(batchSize)}`,
      );
      return false;
    }

    return uploadFiles(supportedFiles);
  };

  const nextUntitledTextFileNumber = () => {
    const largestExistingNumber =
      room?.items.reduce((largest, item) => {
        if (item.type !== 'file') return largest;
        const match = UNTITLED_TEXT_FILE_PATTERN.exec(item.name);
        return match ? Math.max(largest, Number(match[1])) : largest;
      }, 0) ?? 0;
    return Math.max(
      nextUntitledTextFileNumberRef.current,
      largestExistingNumber + 1,
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void submitFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    void submitFiles(Array.from(event.dataTransfer.files));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      void submitFiles(files);
    }
  };

  const submitTextFile = async (text: string) => {
    const fileNumber = nextUntitledTextFileNumber();
    const file = new File([text], `无标题文件${fileNumber}.txt`, {
      type: 'text/plain',
    });
    if (await submitFiles([file])) {
      nextUntitledTextFileNumberRef.current = fileNumber + 1;
      return true;
    }
    return false;
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
    submitTextFile,
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
