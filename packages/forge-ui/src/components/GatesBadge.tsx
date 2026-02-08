/**
 * GatesBadge - Badge showing count of pending gates
 *
 * Displays a warning-colored badge with the number of pending gates.
 * Click opens gate review panel. Hidden when no gates are pending.
 */

import { cn } from '@/lib/utils';

interface GatesBadgeProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export function GatesBadge({ count, onClick, className }: GatesBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-amber-500/10 border border-amber-500/20',
        'text-amber-500 text-sm font-medium',
        'hover:bg-amber-500/20 hover:border-amber-500/30',
        'transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
        className
      )}
      title={`${count} pending gate${count !== 1 ? 's' : ''} requiring approval`}
    >
      <GateIcon className="h-4 w-4" />
      <span>{count}</span>
    </button>
  );
}

/**
 * GatesBadgeCompact - Smaller badge variant for tight spaces
 */
export function GatesBadgeCompact({ count, onClick, className }: GatesBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full',
        'bg-amber-500 text-bg-deep text-xs font-semibold',
        'hover:bg-amber-400 transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
        className
      )}
      title={`${count} pending gate${count !== 1 ? 's' : ''}`}
    >
      {count}
    </button>
  );
}

function GateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
