import { IconProps, iconSizes } from './types';

/**
 * PencilIcon
 *
 * User edit indicator icon. Used to show that content has been modified by a user.
 * Follows standard icon pattern with currentColor for theming.
 *
 * @example
 * ```tsx
 * <PencilIcon size="sm" className="text-accent-cyan" />
 * ```
 */
export function PencilIcon({ size = 'md', className = '' }: IconProps) {
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
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}
