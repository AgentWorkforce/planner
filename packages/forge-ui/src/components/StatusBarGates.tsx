/**
 * StatusBarGates - Gate status indicator for status bar
 *
 * Shows:
 * - Gate icon with count badge
 * - Warning color when gates pending
 * - Clickable to open gate approval panel
 * - Pulsing animation when attention needed
 */

import { cn } from '@/lib/utils';

interface StatusBarGatesProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

export function StatusBarGates({ count, onClick, className }: StatusBarGatesProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md',
        'bg-amber-500/10 hover:bg-amber-500/20',
        'border border-amber-500/20 hover:border-amber-500/30',
        'text-amber-500',
        'transition-all cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
        className
      )}
      title={`${count} pending gate${count !== 1 ? 's' : ''} requiring approval`}
    >
      {/* Gate icon with pulsing animation */}
      <div className="relative">
        <GateIcon className="h-4 w-4" />
        {/* Pulsing ring for attention */}
        <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/30" />
      </div>

      {/* Count badge */}
      <span className="text-xs font-semibold">{count}</span>
    </button>
  );
}

/**
 * Gate/shield icon
 */
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
