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
  maxFilesPerBatch: 1,
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
    selectFiles([new File(['a'], 'a.txt'), new File(['b'], 'b.txt')]);
    expect(notify.error).toHaveBeenLastCalledWith('单次最多选择 1 个文件');

    selectFiles([new File(['123456'], 'large.txt')]);
    expect(notify.error).toHaveBeenLastCalledWith('单批文件总大小不能超过 5 B');

    selectFiles([new File(['1234'], 'ok.txt')]);
    expect(uploadFiles).toHaveBeenCalledOnce();
  });

  it('粘贴文件时复用上传流程并阻止写入输入框', () => {
    const file = new File(['1234'], 'clipboard.png', { type: 'image/png' });
    const preventDefault = pasteFiles([file]);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(uploadFiles).toHaveBeenCalledWith([file]);
  });

  it('粘贴纯文字时保留浏览器默认行为', () => {
    const preventDefault = pasteFiles([]);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(uploadFiles).not.toHaveBeenCalled();
  });
});
