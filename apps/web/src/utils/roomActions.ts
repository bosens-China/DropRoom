import type { RoomCredentials, RoomSnapshot } from '@droproom/api/domain';
import { apiClient, credentialedRequest, unwrapJson } from '../api/client';
import { getMyNickname } from './preferences';
import { saveRoomCredentials } from './roomRegistry';

export async function createRoom(): Promise<RoomSnapshot> {
  const response = await apiClient.rooms.$post(
    { json: { nickname: getMyNickname() } },
    credentialedRequest,
  );
  const credentials = await unwrapJson<RoomCredentials>(response);
  saveRoomCredentials(credentials);
  return credentials.room;
}

export async function joinRoomByCode(rawCode: string): Promise<RoomSnapshot> {
  const code = rawCode.replace(/\s+/g, '');
  const response = await apiClient.rooms[':code'].join.$post(
    {
      param: { code },
      json: { nickname: getMyNickname() },
    },
    credentialedRequest,
  );
  const credentials = await unwrapJson<RoomCredentials>(response);
  saveRoomCredentials(credentials);
  return credentials.room;
}
