import { IconProps, iconSizes } from './types';

/**
 * Security icon (shield).
 * Used in Understanding UI for security observations.
 */
export function SecurityIcon({ size = 'md', className = '' }: IconProps) {
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
      {/* Shield shape */}
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      {/* Checkmark inside shield */}
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
