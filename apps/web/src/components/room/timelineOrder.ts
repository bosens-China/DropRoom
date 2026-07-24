import type { RoomItem } from '@droproom/api/domain';

export function chronologicalTimeline(items: RoomItem[]): RoomItem[] {
  return [...items].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}
