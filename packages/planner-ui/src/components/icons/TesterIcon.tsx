import { IconProps, iconSizes } from './types';

/**
 * Tester icon (flask/beaker).
 * Used in Understanding UI for testing observations.
 */
export function TesterIcon({ size = 'md', className = '' }: IconProps) {
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
      {/* Flask/beaker shape */}
      <path d="M9 3h6" />
      <path d="M10 3v6.5l-5 8.5a2 2 0 0 0 1.71 3h10.58a2 2 0 0 0 1.71-3l-5-8.5V3" />
      <path d="M6 14h12" />
    </svg>
  );
}
