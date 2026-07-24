import { rm } from 'node:fs/promises';
import type {
  FileItem,
  MemberView,
  RoomDestroyReason,
  RoomEvent,
  RoomEventPayload,
  RoomSnapshot,
} from '../domain.js';
import {
  DISSOLVED_DOWNLOAD_RETENTION_MS,
  RoomStoreCore,
  type Room,
  type StoredFile,
} from './core.js';

export abstract class RoomStorePresence extends RoomStoreCore {
  protected disconnectSubscriber(
    room: Room,
    connectionId: string,
    broadcast = true,
  ): void {
    const subscriber = room.subscribers.get(connectionId);
    if (subscriber === undefined) {
      return;
    }

    room.subscribers.delete(connectionId);
    const member = room.members.get(subscriber.memberId);
    member?.connectionIds.delete(connectionId);

    if (member !== undefined && member.connectionIds.size === 0) {
      const currentTime = this.now();
      member.offlineSince = currentTime;
      if (room.ownerMemberId === member.id) {
        room.ownerDisconnectedAt = currentTime;
      }
    }

    if (this.onlineMemberCount(room) === 0) {
      room.emptySince = this.now();
    }

    if (broadcast) {
      this.broadcastPresence(room);
    }
  }

  protected transferOwner(room: Room): void {
    const nextOwner = [...room.members.values()]
      .filter((member) => member.connectionIds.size > 0)
      .sort((left, right) => left.joinOrder - right.joinOrder)[0];

    room.ownerMemberId = nextOwner?.id ?? null;
    room.ownerDisconnectedAt = undefined;
    this.broadcast(room, {
      type: 'room.updated',
      name: room.name,
      ownerMemberId: room.ownerMemberId,
    });
    this.broadcastPresence(room);
  }

  protected pruneOfflineMembers(room: Room, currentTime: number): void {
    for (const member of [...room.members.values()]) {
      if (
        member.id === room.ownerMemberId ||
        member.connectionIds.size > 0 ||
        member.offlineSince === undefined ||
        currentTime - member.offlineSince < this.config.disconnectGraceMs
      ) {
        continue;
      }

      room.members.delete(member.id);
      room.memberIdByToken.delete(member.token);
    }
  }

  protected onlineMemberCount(room: Room): number {
    return [...room.members.values()].filter(
      (member) => member.connectionIds.size > 0,
    ).length;
  }

  private onlineMembers(room: Room): MemberView[] {
    return [...room.members.values()]
      .filter((member) => member.connectionIds.size > 0)
      .sort((left, right) => left.joinOrder - right.joinOrder)
      .map((member) => ({
        id: member.id,
        numberId: member.joinOrder + 1,
        nickname: member.nickname,
        joinedAt: new Date(member.joinedAt).toISOString(),
        isOwner: room.ownerMemberId === member.id,
      }));
  }

  protected snapshot(room: Room, memberId: string): RoomSnapshot {
    return {
      code: room.code,
      name: room.name,
      createdAt: new Date(room.createdAt).toISOString(),
      expiresAt: new Date(room.expiresAt).toISOString(),
      currentMemberId: memberId,
      ownerMemberId: room.ownerMemberId,
      onlineMemberCount: this.onlineMemberCount(room),
      members: this.onlineMembers(room),
      usedBytes: room.usedBytes,
      reservedBytes: room.reservedBytes,
      maxFileBytes: this.config.maxRoomFileBytes,
      maxTextLength: this.config.maxTextLength,
      longTextFileThreshold: this.config.longTextFileThreshold,
      maxFilesPerBatch: this.config.maxFilesPerBatch,
      maxBatchBytes: this.config.maxBatchBytes,
      items: room.items.map((item) =>
        item.type === 'file'
          ? this.fileView(this.requireFile(room, item.id))
          : item,
      ),
    };
  }

  protected fileView(file: StoredFile): FileItem {
    return {
      id: file.id,
      batchId: file.batchId,
      type: 'file',
      senderId: file.senderId,
      senderNumberId: file.senderNumberId,
      senderNickname: file.senderNickname,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      status: file.status,
      uploadedBytes: file.uploadedBytes,
      fingerprint: file.fingerprint,
      chunkSize: file.chunkSize,
      createdAt: file.createdAt,
    };
  }

  protected broadcastPresence(room: Room): void {
    this.broadcast(room, {
      type: 'presence.changed',
      onlineMemberCount: this.onlineMemberCount(room),
      members: this.onlineMembers(room),
    });
  }

  protected broadcast(room: Room, payload: RoomEventPayload): void {
    room.nextEventId += 1;
    const event: RoomEvent = {
      ...payload,
      ...(payload.type === 'item.created' || payload.type === 'item.updated'
        ? {
            usedBytes: room.usedBytes,
            reservedBytes: room.reservedBytes,
          }
        : {}),
      id: room.nextEventId.toString(),
      createdAt: new Date(this.now()).toISOString(),
    };

    for (const subscriber of room.subscribers.values()) {
      subscriber.send(event);
    }
  }

  protected moveCapacityToUsed(room: Room, file: StoredFile): void {
    if (file.capacity !== 'reserved') {
      return;
    }
    room.reservedBytes -= file.size;
    room.usedBytes += file.size;
    file.capacity = 'used';
  }

  protected releaseCapacity(room: Room, file: StoredFile): void {
    if (file.capacity === 'reserved') {
      room.reservedBytes -= file.size;
    } else if (file.capacity === 'used') {
      room.usedBytes -= file.size;
    }
    file.capacity = 'released';
  }

  protected async failUpload(room: Room, file: StoredFile): Promise<void> {
    if (file.status !== 'uploading') {
      return;
    }
    file.cancelRequested = true;
    file.status = 'failed';
    file.active = false;
    this.releaseCapacity(room, file);
    if (file.partialPath !== undefined) {
      await rm(file.partialPath, { force: true });
      file.partialPath = undefined;
    }
    this.broadcast(room, {
      type: 'item.updated',
      item: this.fileView(file),
    });
  }

  protected async failReadyFile(room: Room, file: StoredFile): Promise<void> {
    this.releaseCapacity(room, file);
    file.status = 'failed';
    file.storedPath = undefined;
    this.broadcast(room, {
      type: 'item.updated',
      item: this.fileView(file),
    });
  }

  protected globalFileBytes(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.usedBytes + room.reservedBytes;
    }
    for (const retained of this.retainedStorage.values()) {
      total += retained.bytes;
    }
    return total;
  }

  protected async destroyRoom(
    code: string,
    reason: RoomDestroyReason,
  ): Promise<void> {
    const room = this.rooms.get(code);
    if (room === undefined) {
      return;
    }

    this.broadcast(room, { type: 'room.destroyed', reason });
    for (const subscriber of room.subscribers.values()) {
      subscriber.close();
    }
    room.subscribers.clear();
    this.rooms.delete(code);

    const retainedFileIds =
      reason === 'dissolved'
        ? new Set(room.activeDownloads.keys())
        : new Set<string>();
    if (retainedFileIds.size === 0) {
      await this.removeRoomStorage(code);
      return;
    }

    let retainedBytes = 0;
    const removals: Promise<void>[] = [];
    for (const file of room.files.values()) {
      if (file.storedPath !== undefined && retainedFileIds.has(file.id)) {
        retainedBytes += file.size;
      } else if (file.storedPath !== undefined) {
        removals.push(rm(file.storedPath, { force: true }));
      }
      if (file.partialPath !== undefined) {
        removals.push(rm(file.partialPath, { force: true }));
      }
    }
    this.retainedStorage.set(code, {
      deleteAt: this.now() + DISSOLVED_DOWNLOAD_RETENTION_MS,
      bytes: retainedBytes,
    });
    await Promise.all(removals);
  }
}
