/** 将秒数格式化为 HH:MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** 圆环倒计时等紧凑场景：有小时则 H:MM，否则 M:SS */
export function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}`;
  return `${m}:${s}`;
}

/** 将字节数格式化为可读大小 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1000;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/** 格式化房间码为 4+4 分组展示 */
export function formatRoomCode(roomId: string): string {
  return `${roomId.slice(0, 4)} ${roomId.slice(4)}`;
}
