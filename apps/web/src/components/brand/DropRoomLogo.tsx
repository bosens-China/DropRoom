import { useNavigate } from '@tanstack/react-router';

interface DropRoomLogoProps {
  /** 是否显示文字标题 */
  showText?: boolean;
  /** 尺寸变体 */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  sm: { mark: 'h-7 w-7', text: 'text-base' },
  md: { mark: 'h-9 w-9', text: 'text-xl' },
  lg: { mark: 'h-12 w-12', text: 'text-3xl' },
} as const;

/** DropRoom 品牌标识 */
export function DropRoomLogo({
  showText = true,
  size = 'md',
  className = '',
  onClick,
}: DropRoomLogoProps) {
  const navigate = useNavigate();
  const s = sizeMap[size];

  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : navigate({ to: '/' }))}
      aria-label="返回首页"
      className={`inline-flex items-center gap-2.5 border-none bg-transparent p-0 cursor-pointer transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src="/favicon.svg"
        alt=""
        className={`${s.mark} shrink-0`}
        aria-hidden
      />
      {showText && (
        <span
          className={`${s.text} font-extrabold tracking-tight text-[var(--dr-text)]`}
        >
          Drop<span className="text-[#006EFF]">Room</span>
        </span>
      )}
    </button>
  );
}
