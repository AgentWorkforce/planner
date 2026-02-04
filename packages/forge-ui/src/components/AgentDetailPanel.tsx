/**
 * AgentDetailPanel - Slide-over panel for agent details
 *
 * Features:
 * - Full task context: title, description, acceptance criteria
 * - Recent messages from agent (last 10)
 * - Artifacts produced by this agent
 * - Time elapsed on current task
 */

import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AgentStatus, type ActiveAgent, type AgentMessage, type AgentArtifact } from '@/types';
import { AgentRoleIcon } from './AgentRoleIcon';

interface AgentDetailPanelProps {
  agent: ActiveAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<AgentStatus, string> = {
  [AgentStatus.WORKING]: 'Working',
  [AgentStatus.BLOCKED]: 'Blocked',
  [AgentStatus.IDLE]: 'Idle',
  [AgentStatus.ERROR]: 'Error',
};

const statusColors: Record<AgentStatus, string> = {
  [AgentStatus.WORKING]: 'text-cyan-500',
  [AgentStatus.BLOCKED]: 'text-amber-500',
  [AgentStatus.IDLE]: 'text-gray-500',
  [AgentStatus.ERROR]: 'text-red-500',
};

/**
 * Format elapsed time from heartbeat
 */
function formatElapsed(heartbeat: string): string {
  const elapsed = Date.now() - new Date(heartbeat).getTime();
  const seconds = Math.floor(elapsed / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function AgentDetailPanel({
  agent,
  open,
  onOpenChange,
}: AgentDetailPanelProps) {
  // Calculate elapsed time
  const elapsedTime = useMemo(() => {
    if (!agent?.last_heartbeat) return null;
    return formatElapsed(agent.last_heartbeat);
  }, [agent?.last_heartbeat]);

  if (!agent) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <AgentRoleIcon role={agent.owner_role} status={agent.status} size="lg" />
            <div>
              <SheetTitle className="text-lg">{agent.agent_id}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <span className={statusColors[agent.status]}>
                  {statusLabels[agent.status]}
                </span>
                {agent.owner_role && (
                  <>
                    <span className="text-text-muted">|</span>
                    <span>{agent.owner_role}</span>
                  </>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Task Context */}
          <section>
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
              Current Task
            </h3>
            <div className="bg-bg-hover rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-text-muted mb-1">Title</p>
                <p className="text-sm text-text-primary font-medium">
                  {agent.task_title || 'No active task'}
                </p>
              </div>

              {agent.task_description && (
                <div>
                  <p className="text-xs text-text-muted mb-1">Description</p>
                  <p className="text-sm text-text-secondary">
                    {agent.task_description}
                  </p>
                </div>
              )}

              {elapsedTime && (
                <div>
                  <p className="text-xs text-text-muted mb-1">Time Elapsed</p>
                  <p className="text-sm text-text-primary font-mono">
                    {elapsedTime}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Acceptance Criteria */}
          {agent.acceptance_criteria && agent.acceptance_criteria.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Acceptance Criteria
              </h3>
              <ul className="space-y-2">
                {agent.acceptance_criteria.map((criterion, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <span className="text-text-muted mt-0.5">-</span>
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recent Messages */}
          <section>
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
              Recent Messages
            </h3>
            {agent.recent_messages && agent.recent_messages.length > 0 ? (
              <div className="space-y-2">
                {agent.recent_messages.slice(0, 10).map((message) => (
                  <MessageItem key={message.message_id} message={message} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted text-center py-4">
                No recent messages
              </p>
            )}
          </section>

          {/* Artifacts */}
          {agent.artifacts && agent.artifacts.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Artifacts Produced
              </h3>
              <div className="space-y-2">
                {agent.artifacts.map((artifact) => (
                  <ArtifactItem key={artifact.artifact_id} artifact={artifact} />
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Message item component
 */
interface MessageItemProps {
  message: AgentMessage;
}

function MessageItem({ message }: MessageItemProps) {
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  return (
    <div className="bg-bg-hover rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted font-mono">{timestamp}</span>
      </div>
      <p className="text-sm text-text-secondary">{message.content}</p>
    </div>
  );
}

/**
 * Artifact item component
 */
interface ArtifactItemProps {
  artifact: AgentArtifact;
}

function ArtifactItem({ artifact }: ArtifactItemProps) {
  return (
    <a
      href={artifact.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg',
        'bg-bg-hover hover:bg-bg-tertiary transition-colors',
        'text-text-secondary hover:text-text-primary'
      )}
    >
      <ArtifactIcon type={artifact.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{artifact.label}</p>
        <p className="text-xs text-text-muted truncate">{artifact.type}</p>
      </div>
      <ExternalLinkIcon />
    </a>
  );
}

/**
 * Get icon for artifact type
 */
function ArtifactIcon({ type }: { type: string }) {
  const iconClass = 'h-5 w-5 text-text-muted';

  switch (type.toLowerCase()) {
    case 'file':
    case 'code':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'log':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    case 'link':
    case 'pr':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

/**
 * External link icon
 */
function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-text-muted"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
