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

async function uploadChunk(
  roomId: string,
  item: FileItem,
  file: File,
  signal: AbortSignal,
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
      const response = await apiClient.rooms[':code'].files[
        ':fileId'
      ].content.$put(
        {
          param: { code: roomId, fileId: item.id },
          header: {
            'upload-offset': offset,
            'x-chunk-sha256': chunkHash,
            'x-file-fingerprint': item.fingerprint,
          },
        },
        {
          headers: { 'Content-Type': 'application/octet-stream' },
          init: { body: chunk, signal, credentials: 'include' },
        },
      );
      return await unwrapJson<FileItem>(response);
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
  onProgress: (item: FileItem) => void,
): Promise<FileItem> {
  let item = initialItem;
  while (item.uploadedBytes < item.size) {
    item = await uploadChunk(roomId, item, file, signal);
    onProgress(item);
  }
  return item;
}
