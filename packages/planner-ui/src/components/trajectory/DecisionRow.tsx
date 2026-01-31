/**
 * DecisionRow Component
 *
 * Displays a single decision event in the Decision Log list.
 * Shows question preview, answer badge, reasoning indicator, timestamp, and agent avatar.
 *
 * Props:
 * - decision: The decision event to display
 * - isSelected: Whether this row is currently selected
 * - onClick: Callback when row is clicked
 */

import type { DecisionEvent } from '@/types/trajectory';
import { AgentAvatar } from '@/components/AgentAvatar';
import type { AgentRole } from '@/hooks/useAgentOrchestration';
import { BrainIcon } from '@/components/icons';
import { formatRelativeTime } from '@/utils/time';

interface DecisionRowProps {
  decision: DecisionEvent;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get display text for the answer badge.
 * Shows selected option or "Free text" if only free text was provided.
 */
function getAnswerBadgeText(decision: DecisionEvent): string {
  if (decision.selected_option) {
    return truncateText(decision.selected_option, 30);
  }
  return 'Free text';
}

export function DecisionRow({ decision, isSelected, onClick }: DecisionRowProps) {
  const answerText = getAnswerBadgeText(decision);
  const questionPreview = truncateText(decision.question_text, 60);
  const timeAgo = formatRelativeTime(decision.timestamp);
  const hasReasoning = Boolean(decision.reasoning);

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg
        hover:bg-bg-secondary cursor-pointer
        transition-colors
        ${isSelected ? 'border-l-2 border-accent-cyan bg-bg-secondary' : ''}
      `}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Agent Avatar */}
      <AgentAvatar
        role={decision.asking_agent as AgentRole}
        state="normal"
        size="sm"
        showTooltip={false}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Question preview */}
        <p className="text-sm text-text-primary truncate mb-1">{questionPreview}</p>

        {/* Answer badge and timestamp */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan font-medium">
            {answerText}
          </span>
          <span className="text-text-dim">{timeAgo}</span>
        </div>
      </div>

      {/* Reasoning indicator */}
      {hasReasoning && (
        <div className="flex-shrink-0">
          <BrainIcon size="sm" className="text-text-muted" />
        </div>
      )}
    </div>
  );
}
