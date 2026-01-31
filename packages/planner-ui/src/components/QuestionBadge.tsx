/**
 * QuestionBadge Component
 *
 * Entry point for question queue in the status bar.
 * Shows question count with urgency indicators.
 * Click behavior varies based on queue size:
 * - 0 questions: disabled
 * - 1-5 questions: opens ChatBubble for top question
 * - >5 questions: opens Triage Panel
 */

import { useMemo } from 'react';
import type { Question } from '@/types/plan';

interface QuestionBadgeProps {
  /** Questions from the queue */
  questions: Question[];
  /** Callback when badge is clicked */
  onClick: () => void;
  /** Whether there's an urgent question (waiting > 5min) */
  hasUrgent?: boolean;
}

/**
 * Calculate if any question has been waiting more than the threshold.
 */
function hasUrgentQuestion(questions: Question[], thresholdMinutes: number = 5): boolean {
  if (questions.length === 0) return false;

  const now = Date.now();
  return questions.some((q) => {
    const waitingMs = now - new Date(q.created_at).getTime();
    const waitingMins = waitingMs / 60000;
    return waitingMins >= thresholdMinutes;
  });
}

export function QuestionBadge({
  questions,
  onClick,
  hasUrgent: hasUrgentProp,
}: QuestionBadgeProps) {
  const count = questions.length;
  const isDisabled = count === 0;

  // Determine urgency: either prop override or calculated from oldest question
  const isUrgent = useMemo(() => {
    if (hasUrgentProp !== undefined) return hasUrgentProp;
    return count > 5 || hasUrgentQuestion(questions, 5);
  }, [hasUrgentProp, count, questions]);

  // Determine style based on state
  const getStateClasses = () => {
    if (isDisabled) {
      return 'text-text-muted cursor-not-allowed';
    }
    if (isUrgent) {
      return 'text-error animate-pulse cursor-pointer hover:text-error/80';
    }
    return 'text-text-primary cursor-pointer hover:text-accent-cyan transition-colors';
  };

  const handleClick = () => {
    if (!isDisabled) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      className={`
        flex items-center gap-1 text-sm
        ${getStateClasses()}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      aria-label={`${count} pending questions${isUrgent ? ' (urgent)' : ''}`}
      title={
        isDisabled
          ? 'No pending questions'
          : count <= 5
            ? 'Click to answer top question'
            : 'Click to open triage panel'
      }
    >
      <span aria-hidden="true">❓</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
