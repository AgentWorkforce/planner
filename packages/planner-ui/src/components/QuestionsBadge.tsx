/**
 * QuestionsBadge component.
 *
 * Displays a count of pending questions with a chat bubble icon.
 * Hidden when count is 0.
 */

import { ChatQuestionIcon } from '@/components/icons';

interface QuestionsBadgeProps {
  count: number;
  className?: string;
}

/**
 * Badge showing the number of pending questions awaiting user answer.
 *
 * Format: "2 [chat-bubble-icon]?"
 * Uses warning color scheme for visibility.
 * Returns null when count is 0.
 */
export function QuestionsBadge({ count, className = '' }: QuestionsBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-warning text-xs font-medium ${className}`}
      title={`${count} pending question${count !== 1 ? 's' : ''}`}
      aria-label={`${count} pending question${count !== 1 ? 's' : ''}`}
    >
      <span>{count}</span>
      <ChatQuestionIcon size="sm" />
    </span>
  );
}
