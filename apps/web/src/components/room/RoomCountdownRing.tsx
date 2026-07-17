import { Progress, Tooltip } from 'antd';
import type { RoomSnapshot } from '@droproom/api/domain';
import { formatDurationCompact } from '../../utils/format';

interface RoomCountdownRingProps {
  room: RoomSnapshot;
  timeLeft: number;
}

/** 房间存续圆环倒计时：随时间减少 */
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
      <Progress
        type="circle"
        percent={percent}
        size={48}
        strokeWidth={10}
        strokeColor={strokeColor}
        trailColor="var(--dr-border)"
        format={() => (
          <span
            className="text-[10px] font-mono font-medium leading-none"
            style={{ color: strokeColor }}
          >
            {formatDurationCompact(timeLeft)}
          </span>
        )}
      />
    </Tooltip>
  );
}
