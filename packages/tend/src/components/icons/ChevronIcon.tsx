import { IconProps, iconSizes } from './types';

export type ChevronDirection = 'up' | 'down' | 'left' | 'right';

interface ChevronIconProps extends IconProps {
  direction?: ChevronDirection;
}

const rotations: Record<ChevronDirection, string> = {
  up: 'rotate-180',
  down: 'rotate-0',
  left: 'rotate-90',
  right: '-rotate-90',
};

export function ChevronIcon({ size = 'md', className = '', direction = 'down' }: ChevronIconProps) {
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
      className={`${rotations[direction]} ${className}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
