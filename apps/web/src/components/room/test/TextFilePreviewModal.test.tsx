import type { FileItem } from '@droproom/api/domain';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextFilePreviewModal } from '../TextFilePreviewModal';
import { isTextFile } from '../textFile';

const file: FileItem = {
  id: '00000000-0000-4000-8000-000000000010',
  batchId: '00000000-0000-4000-8000-000000000020',
  type: 'file',
  senderId: '00000000-0000-4000-8000-000000000001',
  senderNumberId: 1,
  senderNickname: '测试设备',
  name: '无标题文件1.txt',
  size: 12,
  mimeType: 'text/plain',
  status: 'ready',
  uploadedBytes: 12,
  fingerprint: 'a'.repeat(64),
  chunkSize: 2_000_000,
  createdAt: new Date().toISOString(),
};

let root: Root;
let container: HTMLDivElement;

describe('TextFilePreviewModal', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('第一行\n第二行')),
    );
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      getComputedStyle(element),
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('识别 text/plain 和 txt 扩展名', () => {
    expect(isTextFile(file)).toBe(true);
    expect(
      isTextFile({
        ...file,
        name: 'README.txt',
        mimeType: 'application/octet-stream',
      }),
    ).toBe(true);
    expect(
      isTextFile({ ...file, name: 'archive.zip', mimeType: 'application/zip' }),
    ).toBe(false);
  });

  it('加载全文并提供复制、下载和关闭按钮', async () => {
    const onCopyText = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <TextFilePreviewModal
          open
          roomCode="12345678"
          file={file}
          onClose={onClose}
          onCopyText={onCopyText}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.textContent).toContain('第一行');
    const label = (element: Element) => element.textContent?.replace(/\s/g, '');
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const copyButton = buttons.find((button) => label(button) === '复制全部');
    const closeButton = buttons.find((button) => label(button) === '关闭');
    const downloadLink = Array.from(document.body.querySelectorAll('a')).find(
      (link) => label(link) === '下载',
    );

    expect(copyButton).toBeDefined();
    expect(closeButton).toBeDefined();
    await act(async () => {
      copyButton?.click();
      closeButton?.click();
    });

    expect(onCopyText).toHaveBeenCalledWith('第一行\n第二行');
    expect(onClose).toHaveBeenCalledOnce();
    expect(downloadLink?.getAttribute('href')).toContain('mode=attachment');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('mode=inline'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
