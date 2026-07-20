import type {
  FileItem,
  RoomItem,
  RoomSnapshot,
  TextItem,
  UploadBatchResponse,
} from '@droproom/api/domain';
import pLimit from 'p-limit';
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  apiClient,
  credentialedRequest,
  errorMessage,
  unwrapJson,
} from '../api/client';
import {
  fileFingerprint,
  uploadFileChunks,
  type UploadProgress,
  type UploadViewState,
} from '../utils/fileUpload';
import { setMyNickname } from '../utils/preferences';
import { updateRoomSnapshot } from '../utils/roomRegistry';

interface RoomActionNotifier {
  error: (content: string) => void;
}

interface UseRoomActionsOptions {
  roomId: string;
  room: RoomSnapshot | null;
  notify: RoomActionNotifier;
  setRoom: Dispatch<SetStateAction<RoomSnapshot | null>>;
}

function upsertItem(items: RoomItem[], item: RoomItem): RoomItem[] {
  const existingIndex = items.findIndex(
    (candidate) => candidate.id === item.id,
  );
  if (existingIndex < 0) return [...items, item];
  return items.map((candidate, index) =>
    index === existingIndex ? item : candidate,
  );
}

export function useRoomActions({
  roomId,
  room,
  notify,
  setRoom,
}: UseRoomActionsOptions) {
  const [uploadLimit] = useState(() =>
    pLimit({ concurrency: 3, rejectOnClear: true }),
  );
  const uploadControllers = useRef(new Map<string, AbortController>());
  const retryFiles = useRef(new Map<string, File>());
  const sendingMessage = useRef(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [uploadStates, setUploadStates] = useState<
    Record<string, UploadViewState>
  >({});

  const setUploadState = (
    fileId: string,
    stage: UploadViewState['stage'],
    progress: UploadProgress,
  ) => {
    setUploadStates((current) => ({
      ...current,
      [fileId]: { stage, ...progress },
    }));
  };
  const clearUploadState = (fileId: string) => {
    setUploadStates((current) => {
      if (!(fileId in current)) return current;
      const next = { ...current };
      delete next[fileId];
      return next;
    });
  };

  const commitRoom = (room: RoomSnapshot) => {
    setRoom(room);
    updateRoomSnapshot(room);
  };

  const commitItem = (item: RoomItem) => {
    setRoom((current) => {
      if (!current) return current;
      const next = { ...current, items: upsertItem(current.items, item) };
      updateRoomSnapshot(next);
      return next;
    });
  };

  const stopUploads = () => {
    uploadLimit.clearQueue();
    uploadControllers.current.forEach((controller) => controller.abort());
    uploadControllers.current.clear();
    retryFiles.current.clear();
    setUploadStates({});
  };

  useEffect(
    () => () => {
      uploadLimit.clearQueue();
      uploadControllers.current.forEach((controller) => controller.abort());
      uploadControllers.current.clear();
      retryFiles.current.clear();
    },
    [uploadLimit],
  );

  const sendMessage = async (content: string): Promise<boolean> => {
    if (sendingMessage.current) return false;
    sendingMessage.current = true;
    setIsSendingMessage(true);
    try {
      const response = await apiClient.rooms[':code'].messages.$post(
        { param: { code: roomId }, json: { content } },
        credentialedRequest,
      );
      commitItem(await unwrapJson<TextItem>(response));
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    } finally {
      sendingMessage.current = false;
      setIsSendingMessage(false);
    }
  };

  const renameRoom = async (name: string): Promise<boolean> => {
    try {
      const response = await apiClient.rooms[':code'].$patch(
        { param: { code: roomId }, json: { name } },
        credentialedRequest,
      );
      commitRoom(await unwrapJson<RoomSnapshot>(response));
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const changeNickname = async (nickname: string): Promise<boolean> => {
    try {
      const response = await apiClient.rooms[':code'].members.me.$patch(
        { param: { code: roomId }, json: { nickname } },
        credentialedRequest,
      );
      commitRoom(await unwrapJson<RoomSnapshot>(response));
      setMyNickname(nickname);
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const leaveRoom = async (): Promise<boolean> => {
    try {
      stopUploads();
      const response = await apiClient.rooms[':code'].leave.$post(
        { param: { code: roomId } },
        credentialedRequest,
      );
      await unwrapJson<{ ok: true }>(response);
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const dissolveRoom = async (): Promise<boolean> => {
    try {
      stopUploads();
      const response = await apiClient.rooms[':code'].$delete(
        { param: { code: roomId } },
        credentialedRequest,
      );
      await unwrapJson<{ ok: true }>(response);
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const runUpload = async (
    fileItem: FileItem,
    file: File,
  ): Promise<boolean> => {
    if (uploadControllers.current.has(fileItem.id)) return false;
    const controller = new AbortController();
    let confirmedItem = fileItem;
    uploadControllers.current.set(fileItem.id, controller);
    retryFiles.current.set(fileItem.id, file);
    setUploadState(fileItem.id, 'uploading', {
      uploadedBytes: fileItem.uploadedBytes,
      chunkUploadedBytes: 0,
      chunkBytes: 0,
    });

    try {
      const uploaded = await uploadFileChunks(
        roomId,
        fileItem,
        file,
        controller.signal,
        (item) => {
          confirmedItem = item;
          commitItem(item);
        },
        (progress) => setUploadState(fileItem.id, 'uploading', progress),
      );
      commitItem(uploaded);
      retryFiles.current.delete(fileItem.id);
      clearUploadState(fileItem.id);
      return true;
    } catch {
      if (!controller.signal.aborted) {
        setUploadState(fileItem.id, 'paused', {
          uploadedBytes: confirmedItem.uploadedBytes,
          chunkUploadedBytes: 0,
          chunkBytes: 0,
        });
        notify.error(`${file.name}：上传已暂停，可点击继续`);
      }
      return false;
    } finally {
      uploadControllers.current.delete(fileItem.id);
    }
  };

  const uploadFiles = async (files: File[]): Promise<boolean> => {
    try {
      const prepared = await Promise.all(
        files.map(async (source) => ({
          source,
          fingerprint: await fileFingerprint(source),
          item: undefined as FileItem | undefined,
        })),
      );
      const resumable =
        room?.items.filter(
          (item): item is FileItem =>
            item.type === 'file' &&
            item.status === 'uploading' &&
            item.senderId === room.currentMemberId,
        ) ?? [];
      const claimed = new Set<string>();

      for (const task of prepared) {
        const match = resumable.find(
          (item) =>
            !claimed.has(item.id) && item.fingerprint === task.fingerprint,
        );
        if (match) {
          task.item = match;
          claimed.add(match.id);
        }
      }

      const newTasks = prepared.filter((task) => !task.item);
      if (newTasks.length > 0) {
        const reserveResponse = await apiClient.rooms[':code'].uploads.$post(
          {
            param: { code: roomId },
            json: {
              files: newTasks.map(({ source, fingerprint }) => ({
                name: source.name,
                size: source.size,
                mimeType: source.type || 'application/octet-stream',
                fingerprint,
              })),
            },
          },
          credentialedRequest,
        );
        const reserved = await unwrapJson<UploadBatchResponse>(reserveResponse);
        newTasks.forEach((task, index) => {
          task.item = reserved.files[index];
          if (task.item) commitItem(task.item);
        });
      }

      setUploadStates((current) => {
        const next = { ...current };
        prepared.forEach((task) => {
          if (!task.item) return;
          next[task.item.id] = {
            stage: 'queued',
            uploadedBytes: task.item.uploadedBytes,
            chunkUploadedBytes: 0,
            chunkBytes: 0,
          };
        });
        return next;
      });

      const results = await uploadLimit.map(prepared, (task) =>
        task.item ? runUpload(task.item, task.source) : Promise.resolve(false),
      );
      return results.every(Boolean);
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const cancelUpload = async (fileId: string): Promise<boolean> => {
    uploadControllers.current.get(fileId)?.abort();
    try {
      const response = await apiClient.rooms[':code'].files[
        ':fileId'
      ].cancel.$post({ param: { code: roomId, fileId } }, credentialedRequest);
      commitItem(await unwrapJson<FileItem>(response));
      retryFiles.current.delete(fileId);
      clearUploadState(fileId);
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const deleteFile = async (fileId: string): Promise<boolean> => {
    uploadControllers.current.get(fileId)?.abort();
    try {
      const response = await apiClient.rooms[':code'].files[':fileId'].$delete(
        { param: { code: roomId, fileId } },
        credentialedRequest,
      );
      commitItem(await unwrapJson<FileItem>(response));
      retryFiles.current.delete(fileId);
      clearUploadState(fileId);
      return true;
    } catch (error: unknown) {
      notify.error(errorMessage(error));
      return false;
    }
  };

  const retryUpload = async (fileId: string): Promise<boolean> => {
    const file = retryFiles.current.get(fileId);
    if (!file) {
      notify.error('请重新选择同一个文件继续上传');
      return false;
    }
    const item = room?.items.find(
      (candidate): candidate is FileItem =>
        candidate.type === 'file' && candidate.id === fileId,
    );
    if (!item) return false;
    if (item.status === 'uploading') {
      setUploadState(fileId, 'queued', {
        uploadedBytes: item.uploadedBytes,
        chunkUploadedBytes: 0,
        chunkBytes: 0,
      });
      return uploadLimit(() => runUpload(item, file));
    }
    if (!(await deleteFile(fileId))) return false;
    return uploadFiles([file]);
  };
  const canRetryUpload = (fileId: string): boolean =>
    retryFiles.current.has(fileId) && !uploadControllers.current.has(fileId);
  const uploadStateForFile = (fileId: string): UploadViewState | undefined =>
    uploadStates[fileId];

  return {
    sendMessage,
    isSendingMessage,
    renameRoom,
    changeNickname,
    leaveRoom,
    dissolveRoom,
    uploadFiles,
    cancelUpload,
    deleteFile,
    retryUpload,
    canRetryUpload,
    uploadStateForFile,
  };
}
