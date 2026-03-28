/**
 * AgentCard - Card component displaying an active agent
 *
 * Features:
 * - AgentRoleIcon with working pulse animation
 * - Agent ID (shortened if long)
 * - Current task title
 * - Latest status message (truncated to 2 lines)
 * - View Details button
 * - Status dot indicator
 */

import { cn } from '@/lib/utils';
import { AgentStatus, type ActiveAgent } from '@/types';
import { AgentRoleIcon } from './AgentRoleIcon';
import { Button } from '@/components/ui/Button';

interface AgentCardProps {
  agent: ActiveAgent;
  onViewDetails?: (agent: ActiveAgent) => void;
  className?: string;
}

const statusDotColors: Record<AgentStatus, string> = {
  [AgentStatus.WORKING]: 'bg-green-500',
  [AgentStatus.BLOCKED]: 'bg-amber-500',
  [AgentStatus.IDLE]: 'bg-gray-500',
  [AgentStatus.ERROR]: 'bg-red-500',
};

const statusLabels: Record<AgentStatus, string> = {
  [AgentStatus.WORKING]: 'Working',
  [AgentStatus.BLOCKED]: 'Blocked',
  [AgentStatus.IDLE]: 'Idle',
  [AgentStatus.ERROR]: 'Error',
};

/**
 * Shorten agent ID for display
 */
function shortenId(id: string, maxLength = 8): string {
  if (id.length <= maxLength) return id;
  return id.slice(0, maxLength) + '...';
}

export function AgentCard({ agent, onViewDetails, className }: AgentCardProps) {
  const isWorking = agent.status === AgentStatus.WORKING;

  return (
    <div
      className={cn(
        'bg-bg-surface border border-border rounded-lg p-4 flex flex-col gap-3',
        className
      )}
    >
      {/* Header: Icon + Agent ID + Status */}
      <div className="flex items-center gap-3">
        {/* Role icon with pulse animation when working */}
        <div className={cn('relative', isWorking && 'animate-pulse')}>
          <AgentRoleIcon
            role={agent.owner_role}
            status={agent.status}
            size="lg"
          />
        </div>

        {/* Agent ID */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {shortenId(agent.agent_id)}
          </p>
          {agent.owner_role && (
            <p className="text-xs text-text-muted truncate">
              {agent.owner_role}
            </p>
          )}
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              statusDotColors[agent.status],
              isWorking && 'animate-pulse'
            )}
          />
          <span className="text-xs text-text-muted">
            {statusLabels[agent.status]}
          </span>
        </div>
      </div>

      {/* Current task */}
      <div className="flex-1">
        <p className="text-xs text-text-muted uppercase tracking-wide mb-1">
          Current Task
        </p>
        <p className="text-sm text-text-secondary line-clamp-1">
          {agent.task_title || 'No active task'}
        </p>
      </div>

      {/* Latest message */}
      {agent.last_message && (
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">
            Status
          </p>
          <p className="text-sm text-text-secondary line-clamp-2">
            {agent.last_message}
          </p>
        </div>
      )}

      {/* View Details button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-auto"
        onClick={() => onViewDetails?.(agent)}
      >
        View Details
      </Button>
    </div>
  );
}

/**
 * Skeleton loader for AgentCard
 */
export function AgentCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-bg-surface border border-border rounded-lg p-4 flex flex-col gap-3',
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-bg-tertiary animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-20 rounded bg-bg-tertiary animate-pulse" />
          <div className="h-3 w-16 rounded bg-bg-tertiary animate-pulse" />
        </div>
        <div className="h-2 w-2 rounded-full bg-bg-tertiary animate-pulse" />
      </div>

      {/* Task skeleton */}
      <div>
        <div className="h-3 w-16 rounded bg-bg-tertiary animate-pulse mb-1" />
        <div className="h-4 w-full rounded bg-bg-tertiary animate-pulse" />
      </div>

      {/* Message skeleton */}
      <div>
        <div className="h-3 w-12 rounded bg-bg-tertiary animate-pulse mb-1" />
        <div className="h-4 w-full rounded bg-bg-tertiary animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-bg-tertiary animate-pulse mt-1" />
      </div>

      {/* Button skeleton */}
      <div className="h-8 w-full rounded bg-bg-tertiary animate-pulse mt-auto" />
    </div>
  );
}
