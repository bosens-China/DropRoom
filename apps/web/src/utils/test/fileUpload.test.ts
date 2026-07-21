import type { FileItem } from '@droproom/api/domain';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MockApiRequestError = vi.hoisted(
  () =>
    class ApiRequestError extends Error {
      readonly status: number;

      constructor(status: number) {
        super(`请求失败（${status}）`);
        this.status = status;
      }
    },
);

vi.mock('../../api/client', () => ({
  apiClient: {
    rooms: {
      ':code': {
        files: {
          ':fileId': {
            content: {
              $url: ({ param }: { param: { code: string; fileId: string } }) =>
                new URL(
                  `http://localhost:43117/rooms/${param.code}/files/${param.fileId}/content`,
                ),
            },
          },
        },
      },
    },
  },
  ApiRequestError: MockApiRequestError,
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : '上传失败',
  unwrapJson: async (response: Response) => {
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw new MockApiRequestError(response.status);
    }
    return payload;
  },
}));

import {
  fileFingerprint,
  uploadFileChunks,
  type UploadProgress,
} from '../fileUpload';

const initialFile: FileItem = {
  id: '00000000-0000-4000-8000-000000000010',
  batchId: '00000000-0000-4000-8000-000000000020',
  type: 'file',
  senderId: '00000000-0000-4000-8000-000000000001',
  senderNumberId: 1,
  senderNickname: '测试用户',
  name: 'progress.txt',
  size: 5,
  mimeType: 'text/plain',
  status: 'uploading',
  uploadedBytes: 0,
  fingerprint: 'a'.repeat(64),
  chunkSize: 2,
  createdAt: new Date().toISOString(),
};

class FakeXMLHttpRequest extends EventTarget {
  static requestCount = 0;
  static instances: FakeXMLHttpRequest[] = [];
  static outcomes: Array<number | 'pending'> = [];
  readonly upload = new EventTarget();
  readonly headers = new Map<string, string>();
  responseText = '';
  status = 200;
  withCredentials = false;
  aborted = false;
  method = '';
  url = '';

  constructor() {
    super();
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string | URL): void {
    this.method = method;
    this.url = url.toString();
  }

  setRequestHeader(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  send(body: XMLHttpRequestBodyInit | null): void {
    const outcome = FakeXMLHttpRequest.outcomes.shift() ?? 200;
    FakeXMLHttpRequest.requestCount += 1;
    if (outcome === 'pending') return;
    this.status = outcome;
    if (outcome >= 400) {
      this.responseText = JSON.stringify({
        error: { code: 'UPLOAD_ERROR', message: '上传失败' },
      });
      this.dispatchEvent(new Event('load'));
      return;
    }
    const chunk = body instanceof Blob ? body : new Blob();
    const offset = Number(this.headers.get('upload-offset') ?? 0);
    const uploadedBytes = offset + chunk.size;
    this.upload.dispatchEvent(
      new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: Math.ceil(chunk.size / 2),
        total: chunk.size,
      }),
    );
    this.responseText = JSON.stringify({
      ...initialFile,
      uploadedBytes,
      status: uploadedBytes === initialFile.size ? 'ready' : 'uploading',
    });
    this.dispatchEvent(new Event('load'));
  }

  abort(): void {
    this.aborted = true;
    this.dispatchEvent(new Event('abort'));
  }
}

describe('fileFingerprint', () => {
  it('中间内容不同的同名文件不会命中同一续传任务', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const first = makeFingerprintFile(1);
    const second = makeFingerprintFile(2);

    await expect(fileFingerprint(first)).resolves.not.toBe(
      await fileFingerprint(second),
    );
    vi.unstubAllGlobals();
  });
});

describe('uploadFileChunks', () => {
  beforeEach(() => {
    FakeXMLHttpRequest.requestCount = 0;
    FakeXMLHttpRequest.instances = [];
    FakeXMLHttpRequest.outcomes = [];
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
    vi.stubGlobal('crypto', {
      subtle: {
        digest: async () => new Uint8Array(32).buffer,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('同时报告文件总体进度和当前分片进度', async () => {
    const progress: UploadProgress[] = [];
    const uploadedItems: FileItem[] = [];
    const file = makeFile();

    const result = await uploadFileChunks(
      '12345678',
      initialFile,
      file,
      new AbortController().signal,
      (item) => uploadedItems.push(item),
      (value) => progress.push(value),
    );

    expect(FakeXMLHttpRequest.requestCount).toBe(3);
    const firstRequest = FakeXMLHttpRequest.instances[0];
    expect(firstRequest).toMatchObject({
      method: 'PUT',
      url: `http://localhost:43117/rooms/12345678/files/${initialFile.id}/content`,
      withCredentials: true,
    });
    expect(firstRequest?.headers).toEqual(
      new Map([
        ['content-type', 'application/octet-stream'],
        ['upload-offset', '0'],
        ['x-chunk-sha256', '0'.repeat(64)],
        ['x-file-fingerprint', initialFile.fingerprint],
      ]),
    );
    expect(progress).toContainEqual({
      uploadedBytes: 0,
      chunkUploadedBytes: 1,
      chunkBytes: 2,
    });
    expect(progress).toContainEqual({
      uploadedBytes: 2,
      chunkUploadedBytes: 0,
      chunkBytes: 0,
    });
    expect(uploadedItems).toHaveLength(3);
    expect(result).toMatchObject({ status: 'ready', uploadedBytes: 5 });
  });

  it('服务端错误重试，客户端错误直接失败', async () => {
    vi.useFakeTimers();
    FakeXMLHttpRequest.outcomes = [500, 200, 400];
    const file = makeFile();

    const retried = uploadFileChunks(
      '12345678',
      { ...initialFile, chunkSize: 5 },
      file,
      new AbortController().signal,
      () => undefined,
      () => undefined,
    );
    await vi.runAllTimersAsync();
    await expect(retried).resolves.toMatchObject({ status: 'ready' });
    expect(FakeXMLHttpRequest.requestCount).toBe(2);

    await expect(
      uploadFileChunks(
        '12345678',
        { ...initialFile, chunkSize: 5 },
        file,
        new AbortController().signal,
        () => undefined,
        () => undefined,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(FakeXMLHttpRequest.requestCount).toBe(3);
  });

  it('取消上传时中止正在进行的请求', async () => {
    FakeXMLHttpRequest.outcomes = ['pending'];
    const controller = new AbortController();
    const upload = uploadFileChunks(
      '12345678',
      { ...initialFile, chunkSize: 5 },
      makeFile(),
      controller.signal,
      () => undefined,
      () => undefined,
    );
    await vi.waitFor(() => {
      expect(FakeXMLHttpRequest.requestCount).toBe(1);
    });
    controller.abort();

    await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXMLHttpRequest.requestCount).toBe(1);
    expect(FakeXMLHttpRequest.instances[0]?.aborted).toBe(true);
  });
});

function makeFile(): File {
  return {
    size: initialFile.size,
    slice: (start: number, end: number) => {
      const bytes = new Uint8Array(end - start);
      const blob = new Blob([bytes]);
      Object.defineProperty(blob, 'arrayBuffer', {
        value: async () => bytes.buffer,
      });
      return blob;
    },
  } as File;
}

function makeFingerprintFile(middleByte: number): File {
  const bytes = new Uint8Array(140_001);
  bytes[70_000] = middleByte;
  return {
    name: 'same.bin',
    size: bytes.byteLength,
    lastModified: 1,
    slice: (start: number, end: number) => {
      const chunk = bytes.slice(start, end);
      return { arrayBuffer: async () => chunk.buffer } as Blob;
    },
  } as File;
}
