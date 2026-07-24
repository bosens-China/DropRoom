import type { FileItem, RoomItem, TextItem } from '@droproom/api/domain';
import { describe, expect, it } from 'vitest';
import { chronologicalTimeline } from '../timelineOrder';

const uploadingFile: FileItem = {
  id: '00000000-0000-4000-8000-000000000001',
  batchId: '00000000-0000-4000-8000-000000000010',
  type: 'file',
  senderId: '00000000-0000-4000-8000-000000000020',
  senderNumberId: 1,
  senderNickname: '发送者',
  name: '上传中.txt',
  size: 5,
  mimeType: 'text/plain',
  status: 'uploading',
  uploadedBytes: 1,
  fingerprint: 'a'.repeat(64),
  chunkSize: 2,
  createdAt: '2026-07-24T01:00:00.000Z',
};

const laterText: TextItem = {
  id: '00000000-0000-4000-8000-000000000002',
  type: 'text',
  senderId: '00000000-0000-4000-8000-000000000020',
  senderNumberId: 1,
  senderNickname: '发送者',
  content: '稍后发送的文字',
  createdAt: '2026-07-24T01:00:01.000Z',
};

describe('RoomTimeline', () => {
  it('上传任务从创建起就固定在后续文字之前', () => {
    const items: RoomItem[] = [laterText, uploadingFile];

    expect(chronologicalTimeline(items).map((item) => item.id)).toEqual([
      uploadingFile.id,
      laterText.id,
    ]);
    expect(items).toEqual([laterText, uploadingFile]);
  });
});
