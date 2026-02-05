/**
 * QAMessageCard Component
 *
 * Renders answered questions in the channel message stream.
 * Displays Q&A pairs with distinct styling to differentiate
 * from regular chat bubbles.
 *
 * Features:
 * - Mission Control design (dark theme, cyan accents)
 * - Left accent border indicating answered state
 * - Blocking level badges (hard_block, soft_block, preference, fyi)
 * - Agent identity (name + role)
 * - Timestamp display
 */

import type { QAMessagePayload } from '@/types/relay';
import type { QuestionBlockingLevel } from '@/types/plan';

interface QAMessageCardProps extends QAMessagePayload {
  /** Optional timestamp override (ISO string or formatted) */
  timestamp?: string;
}

/** Badge colors per blocking level (from ChatBubble pattern) */
const BLOCKING_BADGE_STYLES: Record<QuestionBlockingLevel, string> = {
  hard_block: 'bg-error text-white',
  soft_block: 'bg-warning/20 text-warning',
  preference: 'bg-warning/20 text-warning',
  fyi: 'bg-accent-cyan/20 text-accent-cyan',
};

/** Badge labels per blocking level */
const BLOCKING_LABELS: Record<QuestionBlockingLevel, string> = {
  hard_block: 'BLOCKING',
  soft_block: 'SOFT BLOCK',
  preference: 'PREFERENCE',
  fyi: 'FYI',
};

/**
 * Format ISO timestamp to relative or absolute display.
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // Under 1 hour: relative
    if (diffMins < 60) {
      if (diffMins < 1) return 'Just now';
      if (diffMins === 1) return '1 min ago';
      return `${diffMins} mins ago`;
    }

    // Over 1 hour: absolute time
    const hours = date.getHours();
    const mins = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const displayMins = mins.toString().padStart(2, '0');
    return `${displayHour}:${displayMins} ${ampm}`;
  } catch {
    return timestamp;
  }
}

export function QAMessageCard({
  questionText,
  answerText,
  agentName,
  agentRole,
  blockingLevel,
  timestamp,
  answeredAt,
}: QAMessageCardProps) {
  const badgeStyle = BLOCKING_BADGE_STYLES[blockingLevel];
  const badgeLabel = BLOCKING_LABELS[blockingLevel];
  const displayTimestamp = timestamp || answeredAt;

  return (
    <div
      className="
        w-full max-w-2xl
        bg-bg-card
        border border-border-subtle
        border-l-4 border-l-accent-cyan
        rounded-lg
        shadow-sm
        overflow-hidden
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-sm">❓</span>
          <span className="text-xs font-medium text-accent-cyan uppercase tracking-wide">
            Question Answered
          </span>
        </div>
        {displayTimestamp && (
          <span className="text-xs text-text-muted">
            {formatTimestamp(displayTimestamp)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Agent info + blocking badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary font-medium">
              {agentName}
            </span>
            <span className="text-xs text-text-muted">
              ({agentRole})
            </span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeStyle}`}>
            {badgeLabel}
          </span>
        </div>

        {/* Question text */}
        <div className="space-y-1">
          <div className="text-xs text-text-muted uppercase tracking-wide">
            Question
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {questionText}
          </p>
        </div>

        {/* Answer text */}
        <div className="space-y-1">
          <div className="text-xs text-text-muted uppercase tracking-wide">
            Answer
          </div>
          <p className="text-sm text-text-primary font-medium leading-relaxed">
            {answerText}
          </p>
        </div>
      </div>
    </div>
  );
}
