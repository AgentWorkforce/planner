import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TreeNodeLayoutProps {
  /** Single-character status icon */
  icon: string;
  /** CSS classes for the icon span */
  iconClassName?: string;
  /** Primary text label */
  label: string;
  /** Content rendered after dot leaders (e.g., dep count, time) */
  trailing?: ReactNode;
  /** Highlighted as selected */
  isSelected?: boolean;
  /** Dimmer highlight (focused but not yet clicked) */
  isFocusedAwaitingClick?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional classes on the container */
  className?: string;
}

/**
 * TreeNodeLayout - Shared skeleton for compact ASCII-tree nodes.
 *
 * Renders: status icon + label + dot leaders + trailing content.
 * Selected/focused states use text color only — no backgrounds, no borders.
 */
export function TreeNodeLayout({
  icon,
  iconClassName,
  label,
  trailing,
  isSelected = false,
  isFocusedAwaitingClick = false,
  onClick,
  className,
}: TreeNodeLayoutProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 cursor-pointer transition-colors font-mono',
        'hover:text-text-primary',
        isSelected && 'text-accent-primary',
        isFocusedAwaitingClick && !isSelected && 'text-accent-primary/70',
        !isSelected && !isFocusedAwaitingClick && 'text-text-secondary',
        className
      )}
    >
      {/* Status indicator */}
      <span className={cn('text-sm flex-shrink-0', iconClassName)}>
        {icon}
      </span>

      {/* Label */}
      <span className="text-sm truncate">{label}</span>

      {/* Dot leaders */}
      <span className="flex-1 min-w-0 overflow-hidden text-text-muted select-none opacity-40 leading-none">
        {'·'.repeat(40)}
      </span>

      {/* Trailing content (dep count, click hint, time, etc.) */}
      {trailing}
    </div>
  );
}
