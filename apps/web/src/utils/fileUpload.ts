import type { FileItem } from '@droproom/api/domain';
import {
  ApiRequestError,
  apiClient,
  errorMessage,
  unwrapJson,
} from '../api/client';

const FINGERPRINT_SAMPLE_BYTES = 64 * 1024;
const MAX_CHUNK_ATTEMPTS = 3;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function sha256(data: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export async function fileFingerprint(file: File): Promise<string> {
  const metadata = new TextEncoder().encode(
    `${file.name}\0${file.size}\0${file.lastModified}\0`,
  );
  const first = new Uint8Array(
    await file.slice(0, FINGERPRINT_SAMPLE_BYTES).arrayBuffer(),
  );
  const last = new Uint8Array(
    await file
      .slice(Math.max(0, file.size - FINGERPRINT_SAMPLE_BYTES))
      .arrayBuffer(),
  );
  const sample = new Uint8Array(metadata.length + first.length + last.length);
  sample.set(metadata);
  sample.set(first, metadata.length);
  sample.set(last, metadata.length + first.length);
  return sha256(sample);
}

export interface UploadProgress {
  uploadedBytes: number;
  chunkUploadedBytes: number;
  chunkBytes: number;
}

export interface UploadViewState extends UploadProgress {
  stage: 'queued' | 'uploading' | 'paused';
}

/** 使用 hc 生成类型安全的路由，并通过原生 XHR 获取浏览器上传进度。 */
function uploadChunkRequest(
  roomId: string,
  item: FileItem,
  chunk: Blob,
  chunkHash: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<FileItem> {
  const url = apiClient.rooms[':code'].files[':fileId'].content.$url({
    param: { code: roomId, fileId: item.id },
  });

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abortRequest);
      callback();
    };
    const abortRequest = () => request.abort();

    request.open('PUT', url);
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.setRequestHeader('Upload-Offset', String(item.uploadedBytes));
    request.setRequestHeader('X-Chunk-Sha256', chunkHash);
    request.setRequestHeader('X-File-Fingerprint', item.fingerprint);
    request.upload.addEventListener('progress', (event) => {
      onProgress(Math.min(event.loaded, chunk.size), chunk.size);
    });
    request.addEventListener('load', () => {
      const response = new Response(request.responseText, {
        status: request.status,
        headers: { 'Content-Type': 'application/json' },
      });
      void unwrapJson<FileItem>(response).then(
        (fileItem) => settle(() => resolve(fileItem)),
        (error: unknown) => settle(() => reject(error)),
      );
    });
    request.addEventListener('error', () =>
      settle(() => reject(new Error('上传连接已中断'))),
    );
    request.addEventListener('abort', () =>
      settle(() => reject(new DOMException('上传已取消', 'AbortError'))),
    );
    signal.addEventListener('abort', abortRequest, { once: true });
    onProgress(0, chunk.size);
    if (signal.aborted) {
      settle(() => reject(new DOMException('上传已取消', 'AbortError')));
      return;
    }
    request.send(chunk);
  });
}

async function uploadChunk(
  roomId: string,
  item: FileItem,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: UploadProgress) => void,
): Promise<FileItem> {
  const offset = item.uploadedBytes;
  const chunk = file.slice(
    offset,
    Math.min(file.size, offset + item.chunkSize),
  );
  const chunkHash = await sha256(await chunk.arrayBuffer());
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt += 1) {
    try {
      return await uploadChunkRequest(
        roomId,
        item,
        chunk,
        chunkHash,
        signal,
        (chunkUploadedBytes, chunkBytes) => {
          onProgress({
            uploadedBytes: offset,
            chunkUploadedBytes,
            chunkBytes,
          });
        },
      );
    } catch (error: unknown) {
      if (signal.aborted) throw error;
      lastError = error;
      if (error instanceof ApiRequestError && error.status < 500) throw error;
      if (attempt + 1 < MAX_CHUNK_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
      }
    }
  }

  throw new Error(errorMessage(lastError));
}

export async function uploadFileChunks(
  roomId: string,
  initialItem: FileItem,
  file: File,
  signal: AbortSignal,
  onItemUploaded: (item: FileItem) => void,
  onProgress: (progress: UploadProgress) => void,
): Promise<FileItem> {
  let item = initialItem;
  while (item.uploadedBytes < item.size) {
    item = await uploadChunk(roomId, item, file, signal, onProgress);
    onItemUploaded(item);
    onProgress({
      uploadedBytes: item.uploadedBytes,
      chunkUploadedBytes: 0,
      chunkBytes: 0,
    });
  }
  return item;
}
