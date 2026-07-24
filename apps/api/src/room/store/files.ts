import { rm, stat } from 'node:fs/promises';
import type { FileItem } from '../domain.js';
import { ApiError } from '../../shared/errors.js';
import type { ActiveDownload, DownloadFile } from './core.js';
import { RoomStoreUploads } from './uploads.js';

export abstract class RoomStoreFiles extends RoomStoreUploads {
  async deleteFile(
    code: string,
    fileId: string,
    token: string,
  ): Promise<FileItem> {
    const { room, member } = this.requireMember(code, token);
    const file = this.requireFile(room, fileId);
    this.assertFileManager(room, member.id, file);

    if (file.status === 'deleted') {
      return this.fileView(file);
    }

    file.cancelRequested = true;
    file.deleteRequested = true;
    this.releaseCapacity(room, file);
    file.status = 'deleted';
    file.uploadedBytes = 0;

    await Promise.all([
      file.partialPath === undefined
        ? Promise.resolve()
        : rm(file.partialPath, { force: true }),
      file.storedPath === undefined
        ? Promise.resolve()
        : rm(file.storedPath, { force: true }),
    ]);
    file.partialPath = undefined;
    file.storedPath = undefined;

    this.broadcast(room, {
      type: 'item.updated',
      item: this.fileView(file),
    });
    return this.fileView(file);
  }

  async getDownload(
    code: string,
    fileId: string,
    token: string,
  ): Promise<DownloadFile> {
    const { room } = this.requireMember(code, token);
    const file = this.requireFile(room, fileId);

    if (file.status !== 'ready' || file.storedPath === undefined) {
      throw new ApiError(404, 'FILE_NOT_AVAILABLE', '文件不可下载');
    }

    const fileStat = await stat(file.storedPath).catch(() => undefined);
    if (fileStat === undefined || !fileStat.isFile()) {
      await this.failReadyFile(room, file);
      throw new ApiError(404, 'FILE_NOT_AVAILABLE', '文件不可下载');
    }

    return {
      path: file.storedPath,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  async beginDownload(
    code: string,
    fileId: string,
    token: string,
  ): Promise<ActiveDownload> {
    const download = await this.getDownload(code, fileId, token);
    const { room } = this.requireMember(code, token);
    const file = this.requireFile(room, fileId);
    if (file.status !== 'ready' || file.storedPath !== download.path) {
      throw new ApiError(404, 'FILE_NOT_AVAILABLE', '文件不可下载');
    }

    room.activeDownloads.set(
      fileId,
      (room.activeDownloads.get(fileId) ?? 0) + 1,
    );
    let active = true;
    return {
      ...download,
      complete: () => {
        if (!active) return;
        active = false;
        const remaining = (room.activeDownloads.get(fileId) ?? 1) - 1;
        if (remaining > 0) {
          room.activeDownloads.set(fileId, remaining);
        } else {
          room.activeDownloads.delete(fileId);
        }
      },
    };
  }

  async runMaintenance(): Promise<void> {
    const currentTime = this.now();

    for (const [code, retained] of [...this.retainedStorage]) {
      if (currentTime >= retained.deleteAt) {
        await this.removeRoomStorage(code);
      }
    }

    for (const room of [...this.rooms.values()]) {
      if (currentTime >= room.expiresAt) {
        await this.destroyRoom(room.code, 'expired');
        continue;
      }

      for (const file of room.files.values()) {
        if (
          file.status === 'uploading' &&
          !file.active &&
          currentTime >= file.reservationExpiresAt
        ) {
          await this.failUpload(room, file);
        }
      }

      if (
        room.ownerMemberId !== null &&
        room.ownerDisconnectedAt !== undefined &&
        currentTime - room.ownerDisconnectedAt >= this.config.disconnectGraceMs
      ) {
        this.transferOwner(room);
      }

      this.pruneOfflineMembers(room, currentTime);

      if (
        room.emptySince !== undefined &&
        currentTime - room.emptySince >= this.config.disconnectGraceMs
      ) {
        await this.destroyRoom(room.code, 'empty');
      }
    }
  }
}
