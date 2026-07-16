import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from 'react';
import type { RoomSnapshot } from '@droproom/api/domain';
import {
  MAX_BATCH_FILE_COUNT,
  MAX_BATCH_SIZE_BYTES,
} from '../utils/roomLimits';

interface UploadNotifier {
  error: (content: string) => void;
}

interface UseRoomUploadsOptions {
  room: RoomSnapshot | null;
  notify: UploadNotifier;
  uploadFiles: (files: File[]) => Promise<boolean>;
}

/** 文件选择、拖放和批次前置校验 */
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
    if (files.length > MAX_BATCH_FILE_COUNT) {
      notify.error(`单次最多选择 ${MAX_BATCH_FILE_COUNT} 个文件`);
      return;
    }

    const batchSize = files.reduce((total, file) => total + file.size, 0);
    if (batchSize > MAX_BATCH_SIZE_BYTES) {
      notify.error('单批文件总大小不能超过 500 MB');
      return;
    }

    const availableSize =
      room.maxFileBytes - room.usedBytes - room.reservedBytes;
    if (batchSize > availableSize) {
      notify.error('房间剩余容量不足，请删除文件后重试');
      return;
    }

    void uploadFiles(files);
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
