/**
 * QuestionNotificationContent Component
 *
 * Mini chat bubble content for question notifications.
 * Displays above agent avatars when a new question arrives.
 *
 * Shows:
 * - Agent role icon
 * - Blocking level badge
 * - Truncated question text (max 50 chars)
 *
 * Styled as a speech bubble pointing toward the avatar below.
 */

import { getRoleConfig } from '@/config/agentRoles';
import type { Question, QuestionBlockingLevel } from '@/types/plan';
import type { AgentRole } from '@/hooks/useAgentOrchestration';

interface QuestionNotificationContentProps {
  question: Question;
  onClick: () => void;
}

/** Badge colors per blocking level */
const BLOCKING_BADGE_STYLES: Record<QuestionBlockingLevel, string> = {
  hard_block: 'bg-error/20 text-error',
  soft_block: 'bg-warning/20 text-warning',
  preference: 'bg-warning/20 text-warning',
  fyi: 'bg-accent-cyan/20 text-accent-cyan',
};

/** Badge labels per blocking level */
const BLOCKING_LABELS: Record<QuestionBlockingLevel, string> = {
  hard_block: 'Blocking',
  soft_block: 'Soft block',
  preference: 'Preference',
  fyi: 'FYI',
};

/**
 * Truncates text to max length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trim() + '…';
}

export function QuestionNotificationContent({
  question,
  onClick,
}: QuestionNotificationContentProps) {
  const roleConfig = getRoleConfig(question.agent_role as AgentRole);
  const badgeStyle = BLOCKING_BADGE_STYLES[question.blocking_level];
  const badgeLabel = BLOCKING_LABELS[question.blocking_level];
  const truncatedText = truncateText(question.text, 50);

  return (
    <div
      onClick={onClick}
      className="
        max-w-64 px-3 py-2
        bg-bg-tertiary
        border border-border-subtle
        rounded-xl rounded-bl-sm
        shadow-lg
        cursor-pointer
        hover:bg-bg-elevated
        transition-colors
      "
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Header: role icon + blocking badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs">{roleConfig.icon}</span>
        <span
          className={`
            text-[10px] px-1.5 py-0.5 rounded font-medium
            ${badgeStyle}
          `}
        >
          {badgeLabel}
        </span>
      </div>

      {/* Question text */}
      <p className="text-sm text-text-primary line-clamp-2">
        {truncatedText}
      </p>
    </div>
  );
}
