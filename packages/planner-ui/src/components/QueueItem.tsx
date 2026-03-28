/**
 * QueueItem Component
 *
 * Displays a single question in the triage list.
 * Shows agent avatar, question metadata, and urgency indicators.
 */

import { useMemo } from 'react';
import { AgentAvatar } from './AgentAvatar';
import { getRoleConfig } from '@/config/agentRoles';
import type { Question } from '@/types/plan';
import type { AgentRole } from '@/hooks/useAgentOrchestration';

interface QueueItemProps {
  /** The question to display */
  question: Question;
  /** Whether this item is currently selected */
  isSelected?: boolean;
  /** Callback when item is clicked */
  onClick: () => void;
}

/**
 * Format waiting time as human-readable string.
 */
function formatWaitingTime(createdAt: string): string {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const waitingMs = now - created;
  const waitingMins = Math.floor(waitingMs / 60000);

  if (waitingMins < 1) return 'now';
  if (waitingMins < 60) return `${waitingMins}m`;
  const waitingHours = Math.floor(waitingMins / 60);
  if (waitingHours < 24) return `${waitingHours}h`;
  const waitingDays = Math.floor(waitingHours / 24);
  return `${waitingDays}d`;
}

/**
 * Get badge styling for blocking level.
 */
function getBlockingBadge(blockingLevel: Question['blocking_level']): {
  text: string;
  className: string;
} {
  switch (blockingLevel) {
    case 'hard_block':
      return {
        text: 'BLOCKS',
        className: 'bg-error/20 text-error',
      };
    case 'soft_block':
      return {
        text: 'SOFT',
        className: 'bg-warning/20 text-warning',
      };
    case 'preference':
      return {
        text: 'PREF',
        className: 'bg-warning/20 text-warning',
      };
    case 'fyi':
      return {
        text: 'FYI',
        className: 'bg-accent-cyan/20 text-accent-cyan',
      };
    default:
      return {
        text: blockingLevel,
        className: 'bg-bg-elevated text-text-muted',
      };
  }
}

/**
 * Calculate waiting duration in minutes for urgency ring.
 */
function getWaitingMinutes(createdAt: string): number {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  return Math.floor((now - created) / 60000);
}

export function QueueItem({ question, isSelected, onClick }: QueueItemProps) {
  const waitingTime = formatWaitingTime(question.created_at);
  const waitingMinutes = getWaitingMinutes(question.created_at);
  const badge = getBlockingBadge(question.blocking_level);

  // Determine avatar state based on blocking level and waiting time
  const avatarState = useMemo(() => {
    if (question.blocking_level === 'hard_block' || question.blocking_level === 'soft_block') {
      return 'needs_input';
    }
    return 'normal';
  }, [question.blocking_level]);

  // Check if role is valid, fallback to 'coder' if unknown
  const agentRole = (
    ['architect', 'ui-designer', 'data-modeler', 'coder', 'tester', 'security'].includes(
      question.agent_role
    )
      ? question.agent_role
      : 'coder'
  ) as AgentRole;

  const roleConfig = getRoleConfig(agentRole);
  const hasMerged = question.merged_from.length > 0;
  const hasSubscribers = question.subscribers.length > 0;

  return (
    <div
      className={`
        flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors
        ${isSelected ? 'bg-bg-elevated' : 'hover:bg-bg-secondary'}
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
      {/* Agent Avatar with urgency indicators */}
      <AgentAvatar
        role={agentRole}
        state={avatarState}
        size="sm"
        waitingDuration={waitingMinutes * 60} // Convert to seconds for the component
        showTooltip={false}
        className="shrink-0 mt-0.5"
      />

      {/* Question info */}
      <div className="flex-1 min-w-0">
        {/* Meta row: agent name, type badge, indicators */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-text-primary truncate">
            {roleConfig.label}
          </span>
          <span
            className={`text-[10px] px-1 rounded ${badge.className}`}
          >
            {badge.text}
          </span>
          {hasMerged && (
            <span className="text-[10px] text-accent-purple">
              merged
            </span>
          )}
          {hasSubscribers && (
            <span className="text-[10px] text-accent-cyan">
              +{question.subscribers.length}
            </span>
          )}
        </div>

        {/* Question preview */}
        <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
          {question.text}
        </p>
      </div>

      {/* Waiting time */}
      <span className="text-[10px] text-text-muted shrink-0">
        {waitingTime}
      </span>
    </div>
  );
}
