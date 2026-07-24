import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApiConfig } from '../../config/env.js';
import { ApiError } from '../../shared/errors.js';
import type { FileItem, RoomEvent, RoomItem, RoomSnapshot } from '../domain.js';

export type Clock = () => number;

export type Member = {
  id: string;
  token: string;
  nickname: string;
  joinedAt: number;
  joinOrder: number;
  offlineSince?: number;
  connectionIds: Set<string>;
};

export type StoredFile = FileItem & {
  capacity: 'reserved' | 'used' | 'released';
  reservationExpiresAt: number;
  active: boolean;
  cancelRequested: boolean;
  deleteRequested: boolean;
  storedPath?: string;
  partialPath?: string;
};

export type Subscriber = {
  id: string;
  memberId: string;
  send: (event: RoomEvent) => void;
  close: () => void;
};

export type Room = {
  code: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  ownerMemberId: string | null;
  nextJoinOrder: number;
  nextEventId: number;
  emptySince?: number;
  ownerDisconnectedAt?: number;
  members: Map<string, Member>;
  memberIdByToken: Map<string, string>;
  items: RoomItem[];
  files: Map<string, StoredFile>;
  subscribers: Map<string, Subscriber>;
  activeDownloads: Map<string, number>;
  usedBytes: number;
  reservedBytes: number;
};

export type UploadInput = {
  name: string;
  size: number;
  mimeType: string;
  fingerprint?: string;
};

export type DownloadFile = {
  path: string;
  name: string;
  size: number;
  mimeType: string;
};

export type ActiveDownload = DownloadFile & {
  complete: () => void;
};

export type RetainedStorage = {
  deleteAt: number;
  bytes: number;
};

export const DISSOLVED_DOWNLOAD_RETENTION_MS = 30 * 60 * 1_000;

export type Subscription = {
  snapshot: RoomSnapshot;
  unsubscribe: () => void;
};

const ROOM_ADJECTIVES = [
  '安静',
  '明亮',
  '轻快',
  '清澈',
  '温暖',
  '自由',
  '蓝色',
  '绿色',
  '银色',
  '橙色',
  '柔和',
  '晴朗',
  '悠然',
  '灵动',
  '闪耀',
  '透明',
  '宁静',
  '遥远',
  '清新',
  '灿烂',
] as const;

const ROOM_NOUNS = [
  '海豚',
  '云朵',
  '灯塔',
  '飞鸟',
  '松树',
  '星球',
  '溪流',
  '纸船',
  '月亮',
  '山谷',
  '鲸鱼',
  '岛屿',
  '森林',
  '萤火',
  '银河',
  '风铃',
  '蒲公英',
  '极光',
  '珊瑚',
  '雨滴',
] as const;

export abstract class RoomStoreCore {
  readonly config: ApiConfig;
  protected readonly now: Clock;
  protected readonly rooms = new Map<string, Room>();
  protected readonly retainedStorage = new Map<string, RetainedStorage>();
  private maintenanceTimer?: NodeJS.Timeout;
  private maintenanceRunning = false;

  constructor(config: ApiConfig, now: Clock = Date.now) {
    this.config = config;
    this.now = now;
  }

  async initialize(): Promise<void> {
    // 临时目录只属于当前 DropRoom 进程；重启即视为所有临时房间失效。
    await mkdir(this.config.storageRoot, { recursive: true });
    const entries = await readdir(this.config.storageRoot);
    await Promise.all(
      entries.map((entry) =>
        rm(join(this.config.storageRoot, entry), {
          recursive: true,
          force: true,
        }),
      ),
    );
    this.retainedStorage.clear();
  }

  startMaintenance(): void {
    if (this.maintenanceTimer !== undefined) {
      return;
    }

    this.maintenanceTimer = setInterval(() => {
      if (this.maintenanceRunning) {
        return;
      }

      this.maintenanceRunning = true;
      void this.runMaintenance().finally(() => {
        this.maintenanceRunning = false;
      });
    }, this.config.maintenanceIntervalMs);
    this.maintenanceTimer.unref();
  }

  stopMaintenance(): void {
    if (this.maintenanceTimer === undefined) {
      return;
    }

    clearInterval(this.maintenanceTimer);
    this.maintenanceTimer = undefined;
  }

  async shutdown(): Promise<void> {
    this.stopMaintenance();
    await Promise.all(
      [...this.rooms.keys()].map((code) => this.destroyRoom(code, 'shutdown')),
    );
    await Promise.all(
      [...this.retainedStorage.keys()].map((code) =>
        this.removeRoomStorage(code),
      ),
    );
  }

  abstract runMaintenance(): Promise<void>;

  protected abstract destroyRoom(
    code: string,
    reason: 'expired' | 'empty' | 'dissolved' | 'shutdown',
  ): Promise<void>;

  protected createMember(
    nickname: string,
    joinOrder: number,
    joinedAt: number,
  ): Member {
    return {
      id: randomUUID(),
      token: randomBytes(32).toString('base64url'),
      nickname,
      joinedAt,
      joinOrder,
      offlineSince: joinedAt,
      connectionIds: new Set(),
    };
  }

  protected generateRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = randomInt(0, 100_000_000).toString().padStart(8, '0');
      if (!this.rooms.has(code) && !this.retainedStorage.has(code)) {
        return code;
      }
    }

    throw new ApiError(503, 'ROOM_CODE_EXHAUSTED', '暂时无法创建房间');
  }

  protected generateRoomName(): string {
    const adjective =
      ROOM_ADJECTIVES[randomInt(0, ROOM_ADJECTIVES.length)] ??
      ROOM_ADJECTIVES[0];
    const noun = ROOM_NOUNS[randomInt(0, ROOM_NOUNS.length)] ?? ROOM_NOUNS[0];
    return `${adjective}${noun}`;
  }

  protected async removeRoomStorage(code: string): Promise<void> {
    if (!this.retainedStorage.has(code)) {
      this.retainedStorage.set(code, { deleteAt: this.now(), bytes: 0 });
    }
    await rm(join(this.config.storageRoot, code), {
      recursive: true,
      force: true,
    });
    this.retainedStorage.delete(code);
  }

  protected requireRoom(code: string): Room {
    const room = this.rooms.get(code);
    if (room === undefined) {
      throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在或已销毁');
    }
    return room;
  }

  protected requireMember(
    code: string,
    token: string,
  ): { room: Room; member: Member } {
    const room = this.requireRoom(code);
    const memberId = room.memberIdByToken.get(token);
    const member =
      memberId === undefined ? undefined : room.members.get(memberId);
    if (member === undefined) {
      throw new ApiError(401, 'INVALID_MEMBER_TOKEN', '成员凭证无效');
    }
    return { room, member };
  }

  protected requireOwner(
    code: string,
    token: string,
  ): { room: Room; member: Member } {
    const result = this.requireMember(code, token);
    if (result.room.ownerMemberId !== result.member.id) {
      throw new ApiError(403, 'OWNER_REQUIRED', '仅房主可以执行此操作');
    }
    return result;
  }

  protected requireFile(room: Room, fileId: string): StoredFile {
    const file = room.files.get(fileId);
    if (file === undefined) {
      throw new ApiError(404, 'FILE_NOT_FOUND', '文件不存在');
    }
    return file;
  }

  protected assertFileManager(
    room: Room,
    memberId: string,
    file: StoredFile,
  ): void {
    if (file.senderId !== memberId && room.ownerMemberId !== memberId) {
      throw new ApiError(403, 'FORBIDDEN', '没有管理该文件的权限');
    }
  }
}
