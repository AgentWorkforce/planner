import { useState } from 'react';
import { ChevronIcon } from '@/components/icons/ChevronIcon';
import { cn } from '@/lib/utils';
import type { Agent } from '@/hooks/useAgentOrchestration';
import { AgentAvatar } from './AgentAvatar';

export interface QuestionNotification {
  agentId: string;
  text: string;
}

interface StatusBarProps {
  /** Agent orchestration data */
  agents?: Agent[];
  /** Pending questions count */
  pendingQuestions?: number;
  /** Session duration in seconds */
  sessionDuration?: number;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Connection status */
  connectionStatus?: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'error';
  /** Current notification to display above an agent avatar */
  currentNotification?: QuestionNotification | null;
  /** Callback when pending questions badge is clicked */
  onPendingClick?: () => void;
  /** Callback when an agent avatar is clicked */
  onAgentClick?: (agent: Agent) => void;
  /** Callback when notification bubble is dismissed */
  onNotificationDismiss?: () => void;
  className?: string;
}

/**
 * StatusBar - Permanent bottom status bar for tend application
 *
 * Provides ambient awareness of agent activity, session stats, and connection status.
 * Positioned by the grid layout's status row — always at the bottom of the viewport.
 *
 * Sections:
 * - Left: Agent avatar slots for active agents
 * - Center: Empty (reserved for future use)
 * - Right: Session timer, pending questions, connection indicator, collapse toggle
 */
export function StatusBar({
  agents = [],
  pendingQuestions = 0,
  sessionDuration = 0,
  defaultCollapsed = false,
  connectionStatus = 'disconnected',
  currentNotification,
  onPendingClick,
  onAgentClick,
  onNotificationDismiss,
  className,
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

  // Connection status display
  // Attention levels: connected=Level 0 (background), disconnected/error=Level 2 (action needed)
  const connectionDisplay = {
    connected: { text: 'Connected', color: 'text-text-tertiary', dotColor: 'bg-success' },
    connecting: { text: 'Connecting...', color: 'text-text-muted', dotColor: 'bg-text-muted animate-pulse' },
    reconnecting: { text: 'Reconnecting...', color: 'text-accent-primary', dotColor: 'bg-accent-primary animate-pulse' },
    disconnected: { text: 'Offline', color: 'text-accent-primary', dotColor: 'bg-accent-primary' },
    error: { text: 'Error', color: 'text-accent-secondary', dotColor: 'bg-accent-secondary' },
  };

  const connectionInfo = connectionDisplay[connectionStatus];

  // Collapsed view
  if (isCollapsed) {
    return (
      <div
        className={cn(
          'w-full h-6 border-t flex items-center justify-center gap-2 relative',
          'bg-bg-secondary border-border-subtle',
          className
        )}
      >
        {/* Agent avatars (small) */}
        <div className="flex items-center gap-1">
          {agents.map((agent) => (
            <AgentAvatar
              key={agent.id}
              role={agent.role}
              state={agent.state}
              size="sm"
              displayName={agent.displayName}
              onClick={() => onAgentClick?.(agent)}
              notification={
                currentNotification?.agentId === agent.id
                  ? { text: currentNotification.text, onDismiss: onNotificationDismiss }
                  : undefined
              }
            />
          ))}
        </div>

        {/* Pending badge - Level 2 (action needed) */}
        {pendingQuestions > 0 && (
          <button
            onClick={handlePendingClick}
            className="text-xs text-accent-primary hover:text-accent-hover transition-colors"
          >
            ❓{pendingQuestions}
          </button>
        )}

        {/* Connection indicator */}
        <div className={cn('w-1.5 h-1.5 rounded-full', connectionInfo.dotColor)} />

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
    <div
      className={cn(
        'w-full h-12 border-t flex items-center px-4 gap-6',
        'bg-bg-secondary border-border-subtle relative',
        className
      )}
    >
      {/* Reconnection indicator */}
      {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-primary/20 overflow-hidden">
          <div className="h-full bg-accent-primary animate-reconnect-slide" />
        </div>
      )}

      {/* Left: Agents section */}
      <div className="flex items-center gap-2 shrink-0">
        {agents.length > 0 ? (
          agents.map((agent) => (
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
              notification={
                currentNotification?.agentId === agent.id
                  ? { text: currentNotification.text, onDismiss: onNotificationDismiss }
                  : undefined
              }
            />
          ))
        ) : (
          <span className="text-text-muted text-sm">Garden is quiet</span>
        )}
      </div>

      {/* Center: Reserved */}
      <div className="flex-1" />

      {/* Right: Stats and meta */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Pending questions - Level 2 (action needed) / Level 3 if >5 (urgent) */}
        <button
          onClick={handlePendingClick}
          className={cn(
            'flex items-center gap-1 text-sm transition-colors',
            pendingQuestions > 0
              ? pendingQuestions > 5
                ? 'text-accent-secondary animate-pulse cursor-pointer hover:text-accent-hover'
                : 'text-accent-primary cursor-pointer hover:text-accent-hover'
              : 'text-text-muted cursor-default'
          )}
          disabled={pendingQuestions === 0}
        >
          ❓ {pendingQuestions}
        </button>

        {/* Session timer */}
        <span className="text-sm text-text-muted font-mono">
          ⏱️ {formatDuration(sessionDuration)}
        </span>

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full', connectionInfo.dotColor)} />
          <span className={cn('text-xs', connectionInfo.color)}>{connectionInfo.text}</span>
        </div>

        {/* Collapse toggle */}
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
