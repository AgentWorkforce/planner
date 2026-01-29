import { IconProps, iconSizes } from './types';

export type ChevronDirection = 'up' | 'down' | 'left' | 'right';

interface ChevronIconProps extends IconProps {
  direction?: ChevronDirection;
}

const rotations: Record<ChevronDirection, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

export function ChevronIcon({
  size = 'md',
  className = '',
  direction = 'right',
}: ChevronIconProps) {
  const s = iconSizes[size];
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
