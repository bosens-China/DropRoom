import { useEffect, useState } from 'react';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { Button, Modal, Spin } from 'antd';
import type { FileItem } from '@droproom/api/domain';
import { fileContentUrl } from '../../api/client';

interface TextFilePreviewModalProps {
  open: boolean;
  roomCode: string;
  file: FileItem;
  onClose: () => void;
  onCopyText: (text: string) => void;
}

/** TXT 文件预览：只在弹窗打开时读取文件内容。 */
export function TextFilePreviewModal({
  open,
  roomCode,
  file,
  onClose,
  onCopyText,
}: TextFilePreviewModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const inlineUrl = fileContentUrl(roomCode, file.id, 'inline');
  const downloadUrl = fileContentUrl(roomCode, file.id, 'attachment');

  useEffect(() => {
    if (!open || content !== null) return;
    const controller = new AbortController();

    void fetch(inlineUrl, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('文本预览加载失败');
        setLoadError('');
        return response.text();
      })
      .then(setContent)
      .catch(() => {
        if (!controller.signal.aborted) setLoadError('文本预览加载失败');
      });

    return () => controller.abort();
  }, [content, inlineUrl, open]);

  return (
    <Modal
      title={file.name}
      open={open}
      onCancel={onClose}
      centered
      width={720}
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2">
          <Button
            icon={<CopyOutlined />}
            disabled={content === null}
            onClick={() => content !== null && onCopyText(content)}
          >
            复制全部
          </Button>
          <Button icon={<DownloadOutlined />} href={downloadUrl}>
            下载
          </Button>
          <Button type="primary" onClick={onClose}>
            关闭
          </Button>
        </div>
      }
    >
      {loadError ? (
        <p role="alert" className="py-12 text-center text-red-500">
          {loadError}
        </p>
      ) : content === null ? (
        <div className="flex min-h-48 items-center justify-center">
          <Spin description="正在加载文本…" />
        </div>
      ) : (
        <pre className="dr-scrollbar max-h-[60vh] overflow-auto rounded-lg bg-[var(--dr-surface-muted)] p-3 text-sm leading-6 whitespace-pre-wrap break-words text-[var(--dr-text)]">
          {content}
        </pre>
      )}
    </Modal>
  );
}
