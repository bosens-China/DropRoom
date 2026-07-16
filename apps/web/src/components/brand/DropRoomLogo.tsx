interface DropRoomLogoProps {
  /** 是否显示文字标题 */
  showText?: boolean;
  /** 尺寸变体 */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
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
}: DropRoomLogoProps) {
  const s = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/favicon.svg"
        alt=""
        className={`${s.mark} shrink-0`}
        aria-hidden
      />
      {showText && (
        <span
          className={`${s.text} font-extrabold tracking-tight text-slate-800`}
        >
          Drop<span className="text-blue-500">Room</span>
        </span>
      )}
    </div>
  );
}
