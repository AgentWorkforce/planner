/**
 * QuestionsBadge - Badge showing count of pending questions
 *
 * Displays a cyan-colored badge with the number of pending questions.
 * Click navigates to question queue view. Hidden when no questions are pending.
 * Updates in real-time via SSE subscription.
 */

import { cn } from '@/lib/utils';

interface QuestionsBadgeProps {
  /** Number of pending questions */
  count: number;
  /** Called when badge is clicked */
  onClick?: () => void;
  /** Optional class name */
  className?: string;
}

export function QuestionsBadge({ count, onClick, className }: QuestionsBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-accent-cyan/10 border border-accent-cyan/20',
        'text-accent-cyan text-sm font-medium',
        'hover:bg-accent-cyan/20 hover:border-accent-cyan/30',
        'transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50',
        className
      )}
      title={`${count} pending question${count !== 1 ? 's' : ''} from agents`}
    >
      <QuestionIcon className="h-4 w-4" />
      <span>{count}</span>
    </button>
  );
}

/**
 * QuestionsBadgeCompact - Smaller badge variant for tight spaces
 */
export function QuestionsBadgeCompact({ count, onClick, className }: QuestionsBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full',
        'bg-accent-cyan text-bg-deep text-xs font-semibold',
        'hover:bg-accent-cyan/80 transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50',
        className
      )}
      title={`${count} pending question${count !== 1 ? 's' : ''}`}
    >
      {count}
    </button>
  );
}

/**
 * QuestionsBadgeWithLabel - Badge with text label for headers
 */
interface QuestionsBadgeWithLabelProps extends QuestionsBadgeProps {
  /** Label text (defaults to "Questions") */
  label?: string;
}

export function QuestionsBadgeWithLabel({
  count,
  onClick,
  label = 'Questions',
  className,
}: QuestionsBadgeWithLabelProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-bg-card border border-border',
        'text-text-primary text-sm',
        'hover:bg-bg-elevated hover:border-accent-cyan/30',
        'transition-colors cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50',
        className
      )}
      title={`${count} pending question${count !== 1 ? 's' : ''} from agents`}
    >
      <QuestionIcon className="h-4 w-4 text-accent-cyan" />
      <span>{label}</span>
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent-cyan text-bg-deep text-xs font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Question mark icon
 */
function QuestionIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
