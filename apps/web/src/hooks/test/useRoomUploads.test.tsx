import type { FileItem, RoomSnapshot } from '@droproom/api/domain';
import { act, useEffect } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomUploads } from '../useRoomUploads';

const notify = { error: vi.fn() };
const uploadFiles = vi.fn<(files: File[]) => Promise<boolean>>(
  async () => true,
);
let root: Root;
let container: HTMLDivElement;
let uploads: ReturnType<typeof useRoomUploads> | undefined;

const room: RoomSnapshot = {
  code: '12345678',
  name: '测试房间',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  currentMemberId: '00000000-0000-4000-8000-000000000001',
  ownerMemberId: '00000000-0000-4000-8000-000000000001',
  onlineMemberCount: 1,
  members: [],
  usedBytes: 0,
  reservedBytes: 0,
  maxFileBytes: 20,
  maxTextLength: 20,
  longTextFileThreshold: 5,
  maxFilesPerBatch: 2,
  maxBatchBytes: 20,
  items: [],
};

function Harness() {
  const roomUploads = useRoomUploads({ room, notify, uploadFiles });
  useEffect(() => {
    uploads = roomUploads;
    return () => {
      uploads = undefined;
    };
  }, [roomUploads]);
  return null;
}

function selectFiles(files: File[]): void {
  if (!uploads) throw new Error('Hook 尚未渲染');
  const event = {
    target: { files: files as unknown as FileList, value: 'selected' },
  } as ChangeEvent<HTMLInputElement>;
  uploads.handleFileChange(event);
}

function pasteClipboard(files: File[] = [], text = '') {
  if (!uploads) throw new Error('Hook 尚未渲染');
  const preventDefault = vi.fn();
  uploads.handlePaste({
    clipboardData: {
      files: files as unknown as FileList,
      getData: vi.fn(() => text),
    },
    preventDefault,
  } as unknown as ClipboardEvent<HTMLTextAreaElement>);
  return preventDefault;
}

describe('useRoomUploads', () => {
  beforeEach(() => {
    room.usedBytes = 0;
    room.items = [];
    notify.error.mockReset();
    uploadFiles.mockClear();
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    uploads = undefined;
  });

  it('使用房间快照中的批次限制', () => {
    const invalidBatches = [
      [new File([], 'empty.txt')],
      [
        new File(['a'], 'a.txt'),
        new File(['b'], 'b.txt'),
        new File(['c'], 'c.txt'),
      ],
      [new File(['123456789012345678901'], 'large.txt')],
    ];
    for (const files of invalidBatches) {
      notify.error.mockClear();
      uploadFiles.mockClear();
      selectFiles(files);
      expect(notify.error).toHaveBeenCalledOnce();
      expect(uploadFiles).not.toHaveBeenCalled();
    }

    const files = [new File(['12'], 'one.txt'), new File(['34'], 'two.txt')];
    selectFiles(files);
    expect(uploadFiles).toHaveBeenCalledWith(files);
  });

  it('跳过空文件并继续上传同批有效文件', () => {
    const validFile = new File(['12'], 'valid.txt');
    selectFiles([new File([], 'empty.txt'), validFile]);

    expect(notify.error).toHaveBeenCalledWith('暂不支持上传空文件');
    expect(uploadFiles).toHaveBeenCalledWith([validFile]);
  });

  it('粘贴多个文件时复用上传流程并阻止写入输入框', () => {
    const files = [
      new File(['12'], 'first.png', { type: 'image/png' }),
      new File(['34'], 'second.png', { type: 'image/png' }),
    ];
    const preventDefault = pasteClipboard(files);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(uploadFiles).toHaveBeenCalledWith(files);
  });

  it('粘贴纯文字时保留浏览器默认行为', () => {
    const preventDefault = pasteClipboard([], '短文字');
    const longTextPreventDefault = pasteClipboard([], '123456');

    expect(preventDefault).not.toHaveBeenCalled();
    expect(longTextPreventDefault).not.toHaveBeenCalled();
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('发送超阈值文字时按序转成 TXT 文件并占用上传容量', async () => {
    if (!uploads) throw new Error('Hook 尚未渲染');
    await uploads.submitTextFile('123456');
    room.items = [
      {
        id: '00000000-0000-4000-8000-000000000010',
        batchId: '00000000-0000-4000-8000-000000000020',
        type: 'file',
        senderId: room.currentMemberId,
        senderNumberId: 1,
        senderNickname: '测试设备',
        name: '无标题文件4.txt',
        size: 6,
        mimeType: 'text/plain',
        status: 'ready',
        uploadedBytes: 6,
        fingerprint: 'a'.repeat(64),
        chunkSize: 2_000_000,
        createdAt: new Date().toISOString(),
      } satisfies FileItem,
    ];
    await uploads.submitTextFile('abcdef');
    await uploads.submitTextFile('ABCDEF');

    expect(uploadFiles).toHaveBeenCalledTimes(3);

    const firstFile = uploadFiles.mock.calls[0]?.[0][0];
    const secondFile = uploadFiles.mock.calls[1]?.[0][0];
    const thirdFile = uploadFiles.mock.calls[2]?.[0][0];
    expect(firstFile).toBeInstanceOf(File);
    expect(firstFile?.name).toBe('无标题文件1.txt');
    expect(firstFile?.type).toBe('text/plain');
    expect(firstFile?.size).toBe(6);
    expect(secondFile?.name).toBe('无标题文件5.txt');
    expect(thirdFile?.name).toBe('无标题文件6.txt');
  });

  it('TXT 上传失败时保留当前序号供再次发送', async () => {
    if (!uploads) throw new Error('Hook 尚未渲染');
    uploadFiles.mockResolvedValueOnce(false);

    expect(await uploads.submitTextFile('123456')).toBe(false);
    expect(await uploads.submitTextFile('abcdef')).toBe(true);
    expect(uploadFiles.mock.calls[0]?.[0][0]?.name).toBe('无标题文件1.txt');
    expect(uploadFiles.mock.calls[1]?.[0][0]?.name).toBe('无标题文件1.txt');
  });

  it('容量不足提示使用房间快照计算出的剩余值', () => {
    room.usedBytes = 19;
    selectFiles([new File(['12'], 'limited.txt')]);

    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('1 B'));
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('2 B'));
    expect(uploadFiles).not.toHaveBeenCalled();
  });
});
