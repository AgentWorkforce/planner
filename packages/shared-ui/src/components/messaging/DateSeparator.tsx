/**
 * DateSeparator Component
 *
 * Horizontal divider with date label for message grouping.
 * Shows "Today", "Yesterday", or formatted date.
 */

import { cn } from '../../utils/cn';

export interface DateSeparatorProps {
  /** Date string (from message timestamp) */
  date: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Format date for display in separator.
 * Returns "Today", "Yesterday", or formatted date.
 */
function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return 'Today';
  }
  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateSeparator({ date, className }: DateSeparatorProps) {
  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div className="flex-1 h-px bg-[var(--color-border-subtle,rgba(255,255,255,0.06))]" />
      <span className="text-xs font-medium text-[var(--color-text-muted,#606070)] px-2">
        {formatDateDisplay(date)}
      </span>
      <div className="flex-1 h-px bg-[var(--color-border-subtle,rgba(255,255,255,0.06))]" />
    </div>
  );
}

export default DateSeparator;
