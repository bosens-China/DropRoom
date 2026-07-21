import { Progress, Tooltip } from 'antd';
import type { RoomSnapshot } from '@droproom/api/domain';
import { formatDurationCompact } from '../../utils/format';

interface RoomCountdownRingProps {
  room: RoomSnapshot;
  timeLeft: number;
}

/** 房间存续倒计时：进度轨道随时间缩短 */
export function RoomCountdownRing({ room, timeLeft }: RoomCountdownRingProps) {
  const totalSeconds = Math.max(
    1,
    Math.floor(
      (Date.parse(room.expiresAt) - Date.parse(room.createdAt)) / 1000,
    ),
  );
  const percent = Math.round((timeLeft / totalSeconds) * 100);

  const strokeColor =
    timeLeft < 300
      ? '#ff4d4f'
      : timeLeft < 1800
        ? '#faad14'
        : 'var(--dr-primary)';

  return (
    <Tooltip title={`房间剩余 ${formatDurationCompact(timeLeft)}`}>
      <div
        className="flex shrink-0 items-center gap-2"
        aria-label={`房间剩余 ${formatDurationCompact(timeLeft)}`}
      >
        <div className="hidden w-12 lg:block">
          <Progress
            percent={percent}
            showInfo={false}
            size="small"
            strokeColor={strokeColor}
            railColor="var(--dr-border)"
          />
        </div>
        <span
          className="min-w-[2.75rem] whitespace-nowrap text-right font-mono text-[11px] font-medium"
          style={{ color: strokeColor }}
        >
          {formatDurationCompact(timeLeft)}
        </span>
      </div>
    </Tooltip>
  );
}
