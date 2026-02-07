/**
 * StatusBar - Fixed bottom status bar with agent avatars
 *
 * Provides ambient awareness of agent activity, project context, and session stats.
 * Fixed to bottom of viewport, visible across all views.
 *
 * Adapted from planner-ui with tend's earth-tone palette.
 *
 * Sections:
 * - Left: Connection status indicator
 * - Center: Agent avatars with progress indicators
 * - Right: Pending question count + stats
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronIcon } from '../icons/ChevronIcon';
import { AgentAvatar } from './AgentAvatar';
import type { Agent } from '../../hooks/useAgentOrchestration';

export type StatusBarSection = 'context' | 'agents' | 'stats' | 'meta';

interface StatusBarProps {
  /** Agent orchestration data */
  agents?: Agent[];
  /** Stats */
  pendingQuestions?: number;
  resolvedDecisions?: number;
  /** Session duration in seconds */
  sessionDuration?: number;
  /** Connection status */
  connectionStatus?: 'connected' | 'disconnected' | 'reconnecting';
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Callback when pending questions badge is clicked */
  onPendingClick?: () => void;
  /** Callback when an agent avatar is clicked */
  onAgentClick?: (agent: Agent) => void;
  /** Callback when notification bubble is clicked */
  onNotificationClick?: () => void;
  /** Render function for notification content */
  renderNotificationContent?: (agent: Agent) => ReactNode;
  className?: string;
}

/**
 * StatusBar - Permanent bottom status bar
 *
 * Provides ambient awareness of agent activity and session stats.
 * Fixed to bottom of viewport, visible across all views.
 */
export function StatusBar({
  agents = [],
  pendingQuestions = 0,
  resolvedDecisions = 0,
  sessionDuration = 0,
  connectionStatus = 'disconnected',
  defaultCollapsed = false,
  onPendingClick,
  onAgentClick,
  onNotificationClick,
  renderNotificationContent,
  className = '',
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

  // Connection indicator (only shown when not connected)
  const showConnectionIndicator = connectionStatus !== 'connected';
  const connectionIndicatorColor = {
    disconnected: 'text-[var(--color-brick)]',
    reconnecting: 'text-[var(--color-clay)]',
    connected: 'text-[var(--color-moss)]',
  }[connectionStatus];

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 h-6 bg-[var(--canvas-bg)] border-t border-[var(--block-draft-border)] z-50 flex items-center justify-center gap-2 ${className}`}>
        {/* Connection indicator */}
        {showConnectionIndicator && (
          <span className={`text-xs ${connectionIndicatorColor}`} title={connectionStatus}>
            ●
          </span>
        )}

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
            className="text-xs text-[var(--color-brick)] hover:text-[var(--color-brick)]/80 transition-colors"
          >
            ❓{pendingQuestions}
          </button>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute right-2 p-0.5 hover:bg-[var(--canvas-card-bg-hover)] rounded text-[var(--text-muted)]"
          aria-label="Expand status bar"
        >
          <ChevronIcon direction="up" size="sm" />
        </button>
      </div>
    );
  }

  // Expanded view
  return (
    <div className={`fixed bottom-0 left-0 right-0 h-12 bg-[var(--canvas-bg)] border-t border-[var(--block-draft-border)] z-50 flex items-center px-4 gap-6 ${className}`}>
      {/* Left section: Connection status */}
      <div className="flex items-center gap-2 shrink-0">
        {showConnectionIndicator && (
          <div className="flex items-center gap-1.5">
            <span className={`${connectionIndicatorColor} text-sm`}>●</span>
            <span className="text-[var(--text-muted)] text-xs">
              {connectionStatus === 'disconnected' ? 'Offline' : 'Reconnecting...'}
            </span>
          </div>
        )}
      </div>

      {/* Center section: Agents */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {agents.length > 0 ? (
          agents.map((agent) => {
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
                showNotification={false}
                notificationContent={
                  renderNotificationContent
                    ? renderNotificationContent(agent)
                    : undefined
                }
                onNotificationClick={onNotificationClick}
              />
            );
          })
        ) : (
          <span className="text-[var(--text-muted)] text-sm">No agents active</span>
        )}
      </div>

      {/* Right section: Stats */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={handlePendingClick}
          className={`flex items-center gap-1 text-sm transition-colors ${
            pendingQuestions > 0
              ? pendingQuestions > 5
                ? 'text-[var(--color-brick)] animate-pulse'
                : 'text-[var(--color-brick)] hover:text-[var(--color-brick)]/80'
              : 'text-[var(--text-muted)] cursor-default'
          }`}
          disabled={pendingQuestions === 0}
        >
          ❓ {pendingQuestions}
        </button>
        <span className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
          ✓ {resolvedDecisions}
        </span>
        <span className="text-sm text-[var(--text-muted)] font-mono">
          ⏱️ {formatDuration(sessionDuration)}
        </span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-[var(--canvas-card-bg-hover)] rounded text-[var(--text-muted)]"
          aria-label="Collapse status bar"
        >
          <ChevronIcon direction="down" size="md" />
        </button>
      </div>
    </div>
  );
}
