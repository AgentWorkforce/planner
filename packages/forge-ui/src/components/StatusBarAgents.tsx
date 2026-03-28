/**
 * StatusBarAgents - Agent status indicators for status bar
 *
 * Shows:
 * - Count of active agents
 * - Up to 5 status dots (green=working, orange=blocked)
 * - '+N' indicator if more than 5 agents
 * - Tooltip with agent names
 */

import { cn } from '@/lib/utils';
import { AgentStatus, type ActiveAgent } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StatusBarAgentsProps {
  agents: ActiveAgent[];
  className?: string;
}

const MAX_VISIBLE_DOTS = 5;

/**
 * Get dot color based on agent status
 */
function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.WORKING:
      return 'bg-success';
    case AgentStatus.BLOCKED:
      return 'bg-amber-500';
    case AgentStatus.ERROR:
      return 'bg-error';
    case AgentStatus.IDLE:
    default:
      return 'bg-text-muted';
  }
}

/**
 * Get status label for tooltip
 */
function getStatusLabel(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.WORKING:
      return 'working';
    case AgentStatus.BLOCKED:
      return 'blocked';
    case AgentStatus.ERROR:
      return 'error';
    case AgentStatus.IDLE:
    default:
      return 'idle';
  }
}

export function StatusBarAgents({ agents, className }: StatusBarAgentsProps) {
  if (agents.length === 0) {
    return null;
  }

  const visibleAgents = agents.slice(0, MAX_VISIBLE_DOTS);
  const remainingCount = agents.length - MAX_VISIBLE_DOTS;
  const workingCount = agents.filter((a) => a.status === AgentStatus.WORKING).length;
  const blockedCount = agents.filter((a) => a.status === AgentStatus.BLOCKED).length;

  // Generate tooltip content
  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="font-medium">{agents.length} Active Agents</div>
      {workingCount > 0 && (
        <div className="text-success">{workingCount} working</div>
      )}
      {blockedCount > 0 && (
        <div className="text-amber-500">{blockedCount} blocked</div>
      )}
      <div className="pt-1 border-t border-border">
        {agents.slice(0, 10).map((agent) => (
          <div key={agent.agent_id} className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                getStatusColor(agent.status)
              )}
            />
            <span className="text-text-secondary truncate max-w-[150px]">
              {agent.owner_role || agent.agent_id}
            </span>
            <span className="text-text-muted">({getStatusLabel(agent.status)})</span>
          </div>
        ))}
        {agents.length > 10 && (
          <div className="text-text-muted">...and {agents.length - 10} more</div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2 cursor-default', className)}>
            {/* Agent icon */}
            <AgentIcon className="h-4 w-4 text-text-muted" />

            {/* Agent count */}
            <span className="text-xs font-medium text-text-secondary">
              {agents.length}
            </span>

            {/* Status dots */}
            <div className="flex items-center gap-0.5">
              {visibleAgents.map((agent) => (
                <span
                  key={agent.agent_id}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    getStatusColor(agent.status),
                    agent.status === AgentStatus.WORKING && 'animate-pulse'
                  )}
                />
              ))}

              {/* +N indicator for overflow */}
              {remainingCount > 0 && (
                <span className="text-[10px] font-medium text-text-muted ml-0.5">
                  +{remainingCount}
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Agent icon (user silhouette)
 */
function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
