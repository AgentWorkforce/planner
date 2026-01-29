import { IconProps, iconSizes } from './types';

export function GateIcon({ size = 'md', className = '' }: IconProps) {
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
    >
      {/* Gate/barrier symbol - horizontal bar with vertical supports */}
      <path d="M4 6h16" />
      <path d="M4 6v4" />
      <path d="M20 6v4" />
      <rect x="2" y="10" width="20" height="4" rx="1" />
      <path d="M6 14v6" />
      <path d="M18 14v6" />
    </svg>
  );
}
