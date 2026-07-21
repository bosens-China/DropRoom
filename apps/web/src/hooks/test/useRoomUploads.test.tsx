import type { RoomSnapshot } from '@droproom/api/domain';
import { act, useEffect } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomUploads } from '../useRoomUploads';

const notify = { error: vi.fn() };
const uploadFiles = vi.fn(async () => true);
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
  maxFileBytes: 10,
  maxTextLength: 20,
  maxFilesPerBatch: 2,
  maxBatchBytes: 5,
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

function pasteFiles(files: File[]) {
  if (!uploads) throw new Error('Hook 尚未渲染');
  const preventDefault = vi.fn();
  uploads.handlePaste({
    clipboardData: { files: files as unknown as FileList },
    preventDefault,
  } as unknown as ClipboardEvent<HTMLTextAreaElement>);
  return preventDefault;
}

describe('useRoomUploads', () => {
  beforeEach(() => {
    room.usedBytes = 0;
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
      [new File(['123456'], 'large.txt')],
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
    const preventDefault = pasteFiles(files);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(uploadFiles).toHaveBeenCalledWith(files);
  });

  it('粘贴纯文字时保留浏览器默认行为', () => {
    const preventDefault = pasteFiles([]);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('容量不足提示使用房间快照计算出的剩余值', () => {
    room.usedBytes = 9;
    selectFiles([new File(['12'], 'limited.txt')]);

    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('1 B'));
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('2 B'));
    expect(uploadFiles).not.toHaveBeenCalled();
  });
});
