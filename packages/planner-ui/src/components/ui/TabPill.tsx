import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TabPill - Reusable pill/tab component for initiative filtering
 *
 * Used in Pipeline view's initiative filter tabs. Supports:
 * - Icon + text content
 * - Selected/unselected states
 * - Optional color tinting for initiatives
 * - Accessible button with focus states
 *
 * Design matches Linear's project tabs pattern.
 *
 * @example
 * ```tsx
 * <TabPill selected={true} onClick={() => console.log('clicked')}>
 *   All
 * </TabPill>
 *
 * <TabPill
 *   selected={false}
 *   onClick={() => {}}
 *   icon={<span>🚀</span>}
 *   color="#e55a2b"
 * >
 *   My Initiative
 * </TabPill>
 * ```
 */

export interface TabPillProps {
  /** Whether this tab is currently selected */
  selected: boolean;
  /** Click handler */
  onClick: () => void;
  /** Tab content (typically text label) */
  children: React.ReactNode;
  /** Optional icon shown before text */
  icon?: React.ReactNode;
  /** Optional initiative color for tinting (hex or CSS color) */
  color?: string;
  /** Additional CSS classes */
  className?: string;
}

export function TabPill({
  selected,
  onClick,
  children,
  icon,
  color,
  className
}: TabPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Base styles
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2',

        // Selected state
        selected && [
          'bg-bg-tertiary border-accent-cyan text-text-primary',
          // Apply color tint if provided
          color && 'border-l-4'
        ],

        // Unselected state
        !selected && [
          'border-border-subtle text-text-secondary',
          'hover:text-text-primary hover:border-border-default'
        ],

        className
      )}
      style={
        selected && color
          ? {
              borderLeftColor: color,
              // Subtle background tint using the initiative color
              backgroundColor: `color-mix(in srgb, ${color} 8%, var(--color-bg-tertiary))`
            }
          : undefined
      }
      aria-pressed={selected}
    >
      {icon && (
        <span className="inline-flex items-center justify-center">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
