import type {
  FileItem,
  RoomSnapshot,
  TextItem,
  UploadBatchResponse,
} from '@droproom/api/domain';
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requests = vi.hoisted(() => ({
  reserve: vi.fn(),
  uploadChunks: vi.fn(),
  cancelUpload: vi.fn(),
  deleteFile: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  apiClient: {
    rooms: {
      ':code': {
        messages: { $post: requests.sendMessage },
        uploads: { $post: requests.reserve },
        files: {
          ':fileId': {
            cancel: { $post: requests.cancelUpload },
            $delete: requests.deleteFile,
          },
        },
      },
    },
  },
  credentialedRequest: { init: { credentials: 'include' } },
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : '请求失败',
  unwrapJson: async (response: Response) => response.json(),
}));

vi.mock('../../utils/fileUpload', () => ({
  fileFingerprint: async () => 'a'.repeat(64),
  uploadFileChunks: requests.uploadChunks,
}));

vi.mock('../../utils/roomRegistry', () => ({
  updateRoomSnapshot: vi.fn(),
}));

import { useRoomActions } from '../useRoomActions';

const FAILED_FILE_ID = '00000000-0000-4000-8000-000000000010';
const MEMBER_ID = '00000000-0000-4000-8000-000000000001';

function makeRoom(): RoomSnapshot {
  return {
    code: '12345678',
    name: '测试房间',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    currentMemberId: MEMBER_ID,
    ownerMemberId: MEMBER_ID,
    onlineMemberCount: 2,
    members: [],
    usedBytes: 0,
    reservedBytes: 0,
    maxFileBytes: 2_000_000_000,
    maxTextLength: 20_000,
    longTextFileThreshold: 5_000,
    maxFilesPerBatch: 50,
    maxBatchBytes: 500_000_000,
    items: [],
  };
}

function makeFile(id: string, status: FileItem['status']): FileItem {
  return {
    id,
    batchId: '00000000-0000-4000-8000-000000000020',
    type: 'file',
    senderId: MEMBER_ID,
    senderNumberId: 1,
    senderNickname: '测试设备',
    name: 'retry.txt',
    size: 5,
    mimeType: 'text/plain',
    status,
    uploadedBytes: status === 'ready' ? 5 : 0,
    fingerprint: 'a'.repeat(64),
    chunkSize: 2_000_000,
    createdAt: new Date().toISOString(),
  };
}

let root: Root;
let container: HTMLDivElement;
let actions: ReturnType<typeof useRoomActions> | undefined;
let startingRoom = makeRoom();

function Harness() {
  const [room, setRoom] = useState<RoomSnapshot | null>(startingRoom);
  const roomActions = useRoomActions({
    roomId: '12345678',
    room,
    notify: { error: vi.fn() },
    setRoom,
  });
  useEffect(() => {
    actions = roomActions;
    return () => {
      actions = undefined;
    };
  }, [roomActions]);
  return null;
}

function currentActions(): ReturnType<typeof useRoomActions> {
  if (!actions) throw new Error('Hook 尚未渲染');
  return actions;
}

async function renderHarness(room = makeRoom()): Promise<void> {
  startingRoom = room;
  await act(async () => {
    root.render(<Harness />);
  });
}

describe('useRoomActions', () => {
  beforeEach(async () => {
    requests.reserve.mockReset();
    requests.uploadChunks.mockReset();
    requests.cancelUpload.mockReset();
    requests.deleteFile.mockReset();
    requests.sendMessage.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });

  it('发送期间阻止重复提交并暴露加载状态', async () => {
    await renderHarness();
    let resolveRequest: ((response: Response) => void) | undefined;
    requests.sendMessage.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    let firstRequest: Promise<boolean> | undefined;
    let duplicateResult = true;
    await act(async () => {
      firstRequest = currentActions().sendMessage('hello');
      duplicateResult = await currentActions().sendMessage('hello');
    });

    expect(duplicateResult).toBe(false);
    expect(currentActions().isSendingMessage).toBe(true);
    expect(requests.sendMessage).toHaveBeenCalledOnce();

    const item: TextItem = {
      id: '00000000-0000-4000-8000-000000000030',
      type: 'text',
      senderId: MEMBER_ID,
      senderNumberId: 1,
      senderNickname: '测试用户',
      content: 'hello',
      createdAt: new Date().toISOString(),
    };
    await act(async () => {
      resolveRequest?.(
        new Response(JSON.stringify(item), {
          status: 201,
        }),
      );
      expect(await firstRequest).toBe(true);
    });
    expect(currentActions().isSendingMessage).toBe(false);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    actions = undefined;
  });

  it('上传暂停后从同一文件任务继续，不重新预留', async () => {
    await renderHarness();
    const reservation: UploadBatchResponse = {
      files: [makeFile(FAILED_FILE_ID, 'uploading')],
    };
    requests.reserve.mockResolvedValueOnce(
      new Response(JSON.stringify(reservation), { status: 201 }),
    );
    requests.uploadChunks
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce(makeFile(FAILED_FILE_ID, 'ready'));
    requests.deleteFile.mockResolvedValue(
      new Response(JSON.stringify(makeFile(FAILED_FILE_ID, 'deleted')), {
        status: 200,
      }),
    );
    const file = new File(['hello'], 'retry.txt', { type: 'text/plain' });

    let firstResult = true;
    await act(async () => {
      firstResult = await currentActions().uploadFiles([file]);
    });
    expect(firstResult).toBe(false);
    expect(currentActions().canRetryUpload(FAILED_FILE_ID)).toBe(true);
    let retryResult = false;
    await act(async () => {
      retryResult = await currentActions().retryUpload(FAILED_FILE_ID);
    });
    expect(retryResult).toBe(true);
    expect(currentActions().canRetryUpload(FAILED_FILE_ID)).toBe(false);

    expect(requests.reserve).toHaveBeenCalledTimes(1);
    expect(requests.deleteFile).not.toHaveBeenCalled();
    expect(requests.uploadChunks).toHaveBeenCalledTimes(2);
  });

  it('刷新后重新选择同一文件时复用服务端上传偏移', async () => {
    const pending = makeFile(FAILED_FILE_ID, 'uploading');
    pending.uploadedBytes = 2;
    const room = makeRoom();
    room.items = [pending];
    await renderHarness(room);
    requests.uploadChunks.mockResolvedValue(makeFile(FAILED_FILE_ID, 'ready'));

    const file = new File(['hello'], 'retry.txt', { type: 'text/plain' });
    let result = false;
    await act(async () => {
      result = await currentActions().uploadFiles([file]);
    });

    expect(result).toBe(true);
    expect(requests.reserve).not.toHaveBeenCalled();
    expect(requests.uploadChunks).toHaveBeenCalledWith(
      '12345678',
      expect.objectContaining({ id: FAILED_FILE_ID, uploadedBytes: 2 }),
      file,
      expect.any(AbortSignal),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('取消排队文件后不会再启动对应上传请求', async () => {
    await renderHarness();
    const fileIds = [10, 11, 12, 13].map(
      (value) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`,
    );
    const reservedFiles = fileIds.map((id) => makeFile(id, 'uploading'));
    requests.reserve.mockResolvedValueOnce(
      new Response(JSON.stringify({ files: reservedFiles }), { status: 201 }),
    );
    requests.cancelUpload.mockResolvedValueOnce(
      new Response(JSON.stringify(makeFile(fileIds[3]!, 'cancelled')), {
        status: 200,
      }),
    );
    const completeUploads: Array<() => void> = [];
    requests.uploadChunks.mockImplementation(
      (_roomId: string, item: FileItem) =>
        new Promise<FileItem>((resolve) => {
          completeUploads.push(() =>
            resolve({ ...item, status: 'ready', uploadedBytes: item.size }),
          );
        }),
    );

    const upload = currentActions().uploadFiles(
      fileIds.map((id) => new File(['hello'], `${id}.txt`)),
    );
    await vi.waitFor(() =>
      expect(requests.uploadChunks).toHaveBeenCalledTimes(3),
    );

    await act(async () => {
      await currentActions().cancelUpload(fileIds[3]!);
      completeUploads.forEach((complete) => complete());
      expect(await upload).toBe(false);
    });
    expect(requests.uploadChunks).toHaveBeenCalledTimes(3);
  });
});
