/**
 * StatusBarQuestions - Question indicator for status bar
 *
 * Shows:
 * - Question icon with count badge
 * - Red color when blocking questions pending
 * - Cyan color for non-blocking questions
 * - Click opens question queue panel
 */

import { cn } from '@/lib/utils';
import { BlockingLevel, type Question } from '@/types';

interface StatusBarQuestionsProps {
  questions: Question[];
  onClick?: () => void;
  className?: string;
}

export function StatusBarQuestions({
  questions,
  onClick,
  className,
}: StatusBarQuestionsProps) {
  if (questions.length === 0) {
    return null;
  }

  // Check if any questions are blocking
  const blockingQuestions = questions.filter(
    (q) =>
      q.blocking_level === BlockingLevel.HARD_BLOCK ||
      q.blocking_level === BlockingLevel.SOFT_BLOCK
  );
  const hasBlocking = blockingQuestions.length > 0;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md',
        hasBlocking
          ? 'bg-error/10 hover:bg-error/20 border border-error/20 hover:border-error/30 text-error'
          : 'bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/20 hover:border-accent-cyan/30 text-accent-cyan',
        'transition-all cursor-pointer',
        'focus:outline-none focus:ring-2',
        hasBlocking ? 'focus:ring-error/50' : 'focus:ring-accent-cyan/50',
        className
      )}
      title={`${questions.length} pending question${questions.length !== 1 ? 's' : ''} from agents${
        hasBlocking ? ` (${blockingQuestions.length} blocking)` : ''
      }`}
    >
      {/* Question icon with optional pulsing for blocking questions */}
      <div className="relative">
        <QuestionIcon className="h-4 w-4" />
        {/* Pulsing ring for blocking questions */}
        {hasBlocking && (
          <span className="absolute inset-0 animate-ping rounded-full bg-error/30" />
        )}
      </div>

      {/* Count badge */}
      <span className="text-xs font-semibold">{questions.length}</span>
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
