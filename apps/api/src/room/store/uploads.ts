import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../../shared/errors.js';
import type { FileItem } from '../domain.js';
import type { StoredFile, UploadInput } from './core.js';
import { RoomStoreMembers } from './members.js';

async function readChunk(
  body: ReadableStream<Uint8Array>,
  expectedLength: number,
  signal: AbortSignal,
): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      if (signal.aborted) {
        throw new ApiError(409, 'UPLOAD_INTERRUPTED', '上传连接已中断');
      }
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > expectedLength) {
        throw new ApiError(413, 'UPLOAD_TOO_LARGE', '上传分片超过声明大小');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total !== expectedLength) {
    throw new ApiError(400, 'INCOMPLETE_CHUNK', '上传分片内容不完整');
  }
  return Buffer.concat(chunks, total);
}

export abstract class RoomStoreUploads extends RoomStoreMembers {
  reserveUploadBatch(
    code: string,
    token: string,
    inputs: UploadInput[],
  ): FileItem[] {
    const { room, member } = this.requireMember(code, token);

    if (inputs.length > this.config.maxFilesPerBatch) {
      throw new ApiError(
        413,
        'TOO_MANY_FILES',
        `单批最多选择${this.config.maxFilesPerBatch}个文件`,
      );
    }

    const batchBytes = inputs.reduce((sum, input) => sum + input.size, 0);
    if (batchBytes > this.config.maxBatchBytes) {
      throw new ApiError(
        413,
        'BATCH_TOO_LARGE',
        `单批文件总大小不能超过${this.config.maxBatchBytes}字节`,
      );
    }
    if (
      room.usedBytes + room.reservedBytes + batchBytes >
      this.config.maxRoomFileBytes
    ) {
      throw new ApiError(409, 'ROOM_CAPACITY_EXCEEDED', '房间文件容量不足');
    }
    if (this.globalFileBytes() + batchBytes > this.config.maxGlobalFileBytes) {
      throw new ApiError(
        503,
        'SERVICE_CAPACITY_EXCEEDED',
        '服务端临时存储空间暂时不足',
      );
    }

    const batchId = randomUUID();
    const currentTime = this.now();
    const files = inputs.map<StoredFile>((input) => ({
      id: randomUUID(),
      batchId,
      type: 'file',
      senderId: member.id,
      senderNumberId: member.joinOrder + 1,
      senderNickname: member.nickname,
      name: input.name,
      size: input.size,
      mimeType: input.mimeType,
      status: 'uploading',
      uploadedBytes: 0,
      fingerprint:
        input.fingerprint ??
        createHash('sha256')
          .update(`${input.name}\0${input.size}\0${input.mimeType}`)
          .digest('hex'),
      chunkSize: this.config.uploadChunkBytes,
      createdAt: new Date(currentTime).toISOString(),
      capacity: 'reserved',
      reservationExpiresAt: currentTime + this.config.uploadReservationMs,
      active: false,
      cancelRequested: false,
      deleteRequested: false,
    }));

    for (const file of files) {
      room.files.set(file.id, file);
      room.items.push(file);
      room.reservedBytes += file.size;
      this.broadcast(room, { type: 'item.created', item: this.fileView(file) });
    }
    return files.map((file) => this.fileView(file));
  }

  async writeUploadChunk(
    code: string,
    fileId: string,
    token: string,
    body: ReadableStream<Uint8Array> | null,
    offset: number,
    contentLength: number | undefined,
    chunkHash: string,
    fingerprint: string,
    signal: AbortSignal,
  ): Promise<FileItem> {
    const { room, member } = this.requireMember(code, token);
    const file = this.requireFile(room, fileId);
    this.assertUploadRequest(member.id, file, {
      body,
      offset,
      contentLength,
      fingerprint,
    });

    const activeUploads = [...room.files.values()].filter(
      (candidate) =>
        candidate.senderId === member.id &&
        candidate.status === 'uploading' &&
        candidate.active,
    ).length;
    if (activeUploads >= this.config.maxActiveUploadsPerMember) {
      throw new ApiError(
        409,
        'TOO_MANY_ACTIVE_UPLOADS',
        `每名成员最多同时上传${this.config.maxActiveUploadsPerMember}个文件`,
      );
    }

    file.active = true;
    file.cancelRequested = false;
    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
    let chunkValidated = false;

    try {
      const chunk = await readChunk(body!, contentLength!, signal);
      if (signal.aborted) {
        throw new ApiError(409, 'UPLOAD_INTERRUPTED', '上传连接已中断');
      }
      const actualHash = createHash('sha256').update(chunk).digest('hex');
      if (actualHash !== chunkHash) {
        throw new ApiError(400, 'CHUNK_HASH_MISMATCH', '上传分片校验失败');
      }
      chunkValidated = true;
      if (file.cancelRequested || file.status !== 'uploading') {
        throw new ApiError(409, 'UPLOAD_CANCELLED', '上传已取消');
      }

      const roomDirectory = join(this.config.storageRoot, room.code);
      const partialPath = join(roomDirectory, `${file.id}.part`);
      await mkdir(roomDirectory, { recursive: true });
      if (offset === 0) await rm(partialPath, { force: true });
      fileHandle = await open(partialPath, offset === 0 ? 'w' : 'r+');

      let written = 0;
      while (written < chunk.byteLength) {
        const result = await fileHandle.write(
          chunk,
          written,
          chunk.byteLength - written,
          offset + written,
        );
        if (result.bytesWritten === 0) {
          throw new Error('文件写入未产生进度');
        }
        written += result.bytesWritten;
      }
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = undefined;

      if (file.cancelRequested || file.status !== 'uploading') {
        await rm(partialPath, { force: true });
        throw new ApiError(409, 'UPLOAD_CANCELLED', '上传已取消');
      }

      file.partialPath = partialPath;
      file.uploadedBytes += chunk.byteLength;
      file.reservationExpiresAt = this.now() + this.config.uploadReservationMs;

      if (file.uploadedBytes === file.size) {
        const storedPath = join(roomDirectory, file.id);
        await rename(partialPath, storedPath);
        file.partialPath = undefined;
        file.storedPath = storedPath;
        file.status = 'ready';
        this.moveCapacityToUsed(room, file);
      }

      this.broadcast(room, {
        type: 'item.updated',
        item: this.fileView(file),
      });
      return this.fileView(file);
    } catch (error: unknown) {
      await fileHandle?.close().catch(() => undefined);
      if (file.cancelRequested) {
        throw new ApiError(409, 'UPLOAD_CANCELLED', '上传已取消');
      }
      if (!(error instanceof ApiError) && !chunkValidated) {
        throw new ApiError(409, 'UPLOAD_INTERRUPTED', '上传连接已中断');
      }
      if (!(error instanceof ApiError)) {
        await this.failUpload(room, file);
        throw new ApiError(500, 'UPLOAD_FAILED', '文件上传失败');
      }
      throw error;
    } finally {
      file.active = false;
    }
  }

  async cancelUpload(
    code: string,
    fileId: string,
    token: string,
  ): Promise<FileItem> {
    const { room, member } = this.requireMember(code, token);
    const file = this.requireFile(room, fileId);
    this.assertFileManager(room, member.id, file);
    if (file.status !== 'uploading') {
      throw new ApiError(409, 'FILE_NOT_UPLOADING', '文件不在上传中');
    }

    file.cancelRequested = true;
    file.status = 'cancelled';
    file.uploadedBytes = 0;
    this.releaseCapacity(room, file);
    if (file.partialPath !== undefined) {
      await rm(file.partialPath, { force: true });
      file.partialPath = undefined;
    }
    this.broadcast(room, {
      type: 'item.updated',
      item: this.fileView(file),
    });
    return this.fileView(file);
  }

  private assertUploadRequest(
    memberId: string,
    file: StoredFile,
    input: {
      body: ReadableStream<Uint8Array> | null;
      offset: number;
      contentLength: number | undefined;
      fingerprint: string;
    },
  ): void {
    if (file.senderId !== memberId) {
      throw new ApiError(403, 'FORBIDDEN', '只能上传自己创建的文件');
    }
    if (file.status !== 'uploading' || file.capacity !== 'reserved') {
      throw new ApiError(409, 'FILE_NOT_UPLOADABLE', '文件当前不能上传');
    }
    if (file.active) {
      throw new ApiError(409, 'UPLOAD_ALREADY_ACTIVE', '文件正在上传');
    }
    if (input.body === null || input.contentLength === undefined) {
      throw new ApiError(400, 'EMPTY_UPLOAD_BODY', '上传分片不能为空');
    }
    if (
      input.contentLength <= 0 ||
      input.contentLength > file.chunkSize ||
      input.offset + input.contentLength > file.size
    ) {
      throw new ApiError(400, 'INVALID_CHUNK_SIZE', '上传分片大小不合法');
    }
    if (input.offset !== file.uploadedBytes) {
      throw new ApiError(409, 'UPLOAD_OFFSET_MISMATCH', '上传位置已经变化');
    }
    if (input.fingerprint !== file.fingerprint) {
      throw new ApiError(409, 'FILE_FINGERPRINT_MISMATCH', '所选文件不匹配');
    }
  }
}
