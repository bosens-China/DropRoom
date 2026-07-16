import { randomUUID } from 'node:crypto';
import { ApiError } from '../../shared/errors.js';
import type { RoomCredentials, RoomSnapshot, TextItem } from '../domain.js';
import type { Room, Subscriber, Subscription } from './core.js';
import { RoomStorePresence } from './presence.js';

export abstract class RoomStoreMembers extends RoomStorePresence {
  createRoom(nickname: string, name?: string): RoomCredentials {
    const currentTime = this.now();
    const member = this.createMember(nickname, 0, currentTime);
    const code = this.generateRoomCode();
    const room: Room = {
      code,
      name: name ?? this.generateRoomName(),
      createdAt: currentTime,
      expiresAt: currentTime + this.config.roomLifetimeMs,
      ownerMemberId: member.id,
      nextJoinOrder: 1,
      nextEventId: 0,
      emptySince: currentTime,
      members: new Map([[member.id, member]]),
      memberIdByToken: new Map([[member.token, member.id]]),
      items: [],
      files: new Map(),
      subscribers: new Map(),
      usedBytes: 0,
      reservedBytes: 0,
    };

    this.rooms.set(code, room);

    return {
      memberToken: member.token,
      room: this.snapshot(room, member.id),
    };
  }

  joinRoom(
    code: string,
    nickname: string,
    memberToken?: string,
  ): RoomCredentials {
    const room = this.rooms.get(code);

    if (room === undefined) {
      throw new ApiError(404, 'ROOM_NOT_FOUND', '房间不存在或已销毁');
    }

    if (memberToken !== undefined) {
      const memberId = room.memberIdByToken.get(memberToken);
      const existingMember =
        memberId === undefined ? undefined : room.members.get(memberId);

      if (existingMember !== undefined) {
        existingMember.nickname = nickname;
        return {
          memberToken: existingMember.token,
          room: this.snapshot(room, existingMember.id),
        };
      }
    }

    if (room.members.size >= this.config.maxMembersPerRoom) {
      throw new ApiError(409, 'ROOM_FULL', '房间人数已达到上限');
    }

    const member = this.createMember(nickname, room.nextJoinOrder, this.now());
    room.nextJoinOrder += 1;
    room.members.set(member.id, member);
    room.memberIdByToken.set(member.token, member.id);

    if (room.ownerMemberId === null) {
      room.ownerMemberId = member.id;
    }

    return {
      memberToken: member.token,
      room: this.snapshot(room, member.id),
    };
  }

  getSnapshot(code: string, token: string): RoomSnapshot {
    const { room, member } = this.requireMember(code, token);
    return this.snapshot(room, member.id);
  }

  subscribe(
    code: string,
    token: string,
    subscriberInput: Omit<Subscriber, 'memberId'>,
  ): Subscription {
    const { room, member } = this.requireMember(code, token);
    const subscriber: Subscriber = {
      ...subscriberInput,
      memberId: member.id,
    };

    room.subscribers.set(subscriber.id, subscriber);
    member.connectionIds.add(subscriber.id);
    member.offlineSince = undefined;
    room.emptySince = undefined;

    if (room.ownerMemberId === member.id) {
      room.ownerDisconnectedAt = undefined;
    }

    this.broadcastPresence(room);

    let unsubscribed = false;
    return {
      snapshot: this.snapshot(room, member.id),
      unsubscribe: () => {
        if (unsubscribed) {
          return;
        }
        unsubscribed = true;
        this.disconnectSubscriber(room, subscriber.id);
      },
    };
  }

  updateNickname(code: string, token: string, nickname: string): RoomSnapshot {
    const { room, member } = this.requireMember(code, token);
    member.nickname = nickname;
    this.broadcastPresence(room);
    return this.snapshot(room, member.id);
  }

  updateRoomName(code: string, token: string, name: string): RoomSnapshot {
    const { room, member } = this.requireOwner(code, token);
    room.name = name;
    this.broadcast(room, {
      type: 'room.updated',
      name: room.name,
      ownerMemberId: room.ownerMemberId,
    });
    return this.snapshot(room, member.id);
  }

  addText(code: string, token: string, content: string): TextItem {
    const { room, member } = this.requireMember(code, token);
    if (content.length > this.config.maxTextLength) {
      throw new ApiError(
        413,
        'TEXT_TOO_LONG',
        `单条文字不能超过${this.config.maxTextLength}字符`,
      );
    }

    const item: TextItem = {
      id: randomUUID(),
      type: 'text',
      senderId: member.id,
      senderNumberId: member.joinOrder + 1,
      senderNickname: member.nickname,
      content,
      createdAt: new Date(this.now()).toISOString(),
    };
    room.items.push(item);
    this.broadcast(room, { type: 'item.created', item });
    return item;
  }

  async leaveRoom(code: string, token: string): Promise<void> {
    const { room, member } = this.requireMember(code, token);
    const wasOwner = room.ownerMemberId === member.id;

    for (const connectionId of [...member.connectionIds]) {
      room.subscribers.get(connectionId)?.close();
      this.disconnectSubscriber(room, connectionId, false);
    }

    room.members.delete(member.id);
    room.memberIdByToken.delete(member.token);

    if (wasOwner) {
      this.transferOwner(room);
    }

    if (this.onlineMemberCount(room) === 0) {
      room.emptySince = this.now();
    }

    this.broadcastPresence(room);
  }

  async dissolveRoom(code: string, token: string): Promise<void> {
    this.requireOwner(code, token);
    await this.destroyRoom(code, 'dissolved');
  }
}
