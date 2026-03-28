import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronIcon } from './icons/ChevronIcon';
import { AgentAvatar } from './AgentAvatar';
import type { Agent } from '@/hooks/useAgentOrchestration';
import type { QuestionNotification } from '@/hooks/useQuestionNotifications';
import type { PlanStatus, Question } from '@/types';

export type StatusBarSection = 'context' | 'agents' | 'stats' | 'meta';

interface StatusBarProps {
  /** Current plan info */
  planName?: string;
  planVersion?: number;
  planStatus?: PlanStatus;
  /** Agent orchestration data */
  agents?: Agent[];
  /** Stats */
  pendingQuestions?: number;
  resolvedDecisions?: number;
  /** Session duration in seconds */
  sessionDuration?: number;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Callback when pending questions badge is clicked */
  onPendingClick?: () => void;
  /** Callback when an agent avatar is clicked */
  onAgentClick?: (agent: Agent) => void;
  /** Current notification to display above matching agent avatar */
  currentNotification?: QuestionNotification | null;
  /** Callback when notification bubble is clicked */
  onNotificationClick?: () => void;
  /** Render function for notification content */
  renderNotificationContent?: (question: Question) => ReactNode;
}

/**
 * StatusBar - Permanent bottom status bar
 *
 * Provides ambient awareness of agent activity, plan context, and session stats.
 * Fixed to bottom of viewport, visible across all views.
 *
 * Sections:
 * - Context: Plan name, version, status badge
 * - Agents: Avatar slots for active agents
 * - Stats: Pending questions, resolved decisions
 * - Meta: Session timer, collapse toggle
 */
export function StatusBar({
  planName,
  planVersion,
  planStatus,
  agents = [],
  pendingQuestions = 0,
  resolvedDecisions = 0,
  sessionDuration = 0,
  defaultCollapsed = false,
  onPendingClick,
  onAgentClick,
  currentNotification,
  onNotificationClick,
  renderNotificationContent,
}: StatusBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Format session duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle clicking pending questions
  const handlePendingClick = () => {
    if (pendingQuestions > 0 && onPendingClick) {
      onPendingClick();
    }
  };

  // Status badge variant
  const statusVariant = {
    draft: 'bg-warning/10 text-warning',
    approved: 'bg-success/10 text-success',
    published: 'bg-accent-cyan/10 text-accent-cyan',
  };

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-6 bg-bg-secondary border-t border-border-subtle z-50 flex items-center justify-center gap-2">
        {/* Agent avatars (small) */}
        <div className="flex items-center gap-1">
          {agents.map((agent) => (
            <AgentAvatar
              key={agent.id}
              role={agent.role}
              state={agent.state}
              size="sm"
              displayName={agent.displayName}
              currentActivity={agent.currentActivity}
              currentStep={agent.currentStep}
              currentThought={agent.currentThought}
              onClick={() => onAgentClick?.(agent)}
            />
          ))}
        </div>

        {/* Pending badge */}
        {pendingQuestions > 0 && (
          <button
            onClick={handlePendingClick}
            className="text-xs text-error hover:text-error/80 transition-colors"
          >
            ❓{pendingQuestions}
          </button>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute right-2 p-0.5 hover:bg-bg-tertiary rounded text-text-muted"
          aria-label="Expand status bar"
        >
          <ChevronIcon direction="up" size="sm" />
        </button>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-bg-secondary border-t border-border-subtle z-50 flex items-center px-4 gap-6">
      {/* Context section */}
      <div className="flex items-center gap-2 shrink-0">
        {planName ? (
          <>
            <span className="text-text-muted">📋</span>
            <span className="text-text-primary text-sm font-medium truncate max-w-[200px]">
              {planName}
            </span>
            {planVersion !== undefined && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-tertiary text-text-muted border border-border-default">
                v{planVersion}
              </span>
            )}
            {planStatus && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${statusVariant[planStatus]}`}
              >
                {planStatus}
              </span>
            )}
          </>
        ) : (
          <span className="text-text-muted text-sm">No active plan</span>
        )}
      </div>

      {/* Agents section */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {agents.length > 0 ? (
          agents.map((agent) => {
            // Match notification by agent ID or role (questions may use role as agent_id)
            const isNotificationAgent =
              currentNotification?.agentId === agent.id ||
              currentNotification?.agentId === agent.role;
            return (
              <AgentAvatar
                key={agent.id}
                role={agent.role}
                state={agent.state}
                size="md"
                displayName={agent.displayName}
                currentActivity={agent.currentActivity}
                currentStep={agent.currentStep}
                currentThought={agent.currentThought}
                onClick={() => onAgentClick?.(agent)}
                showNotification={isNotificationAgent}
                notificationContent={
                  isNotificationAgent && renderNotificationContent
                    ? renderNotificationContent(currentNotification.question)
                    : undefined
                }
                onNotificationClick={onNotificationClick}
              />
            );
          })
        ) : (
          <span className="text-text-muted text-sm">No agents active</span>
        )}
      </div>

      {/* Stats section */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={handlePendingClick}
          className={`flex items-center gap-1 text-sm transition-colors ${
            pendingQuestions > 0
              ? pendingQuestions > 5
                ? 'text-error animate-pulse'
                : 'text-error hover:text-error/80'
              : 'text-text-muted cursor-default'
          }`}
          disabled={pendingQuestions === 0}
        >
          ❓ {pendingQuestions}
        </button>
        <span className="flex items-center gap-1 text-sm text-text-muted">
          ✓ {resolvedDecisions}
        </span>
      </div>

      {/* Meta section */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-text-muted font-mono">
          ⏱️ {formatDuration(sessionDuration)}
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-bg-tertiary rounded text-text-muted"
          aria-label="Collapse status bar"
        >
          <ChevronIcon direction="down" size="md" />
        </button>
      </div>
    </div>
  );
}
