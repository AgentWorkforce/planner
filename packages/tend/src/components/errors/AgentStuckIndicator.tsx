import { cn } from '@/lib/utils';
import { ClockIcon } from '@/components/icons/ClockIcon';
import { ZapIcon } from '@/components/icons/ZapIcon';

export interface AgentStuckIndicatorProps {
  agentRole: string;
  stuckDuration: number; // in minutes
  onPoke?: () => void;
  className?: string;
}

/**
 * AgentStuckIndicator - Shows when an agent has been working too long without progress
 *
 * Warning state (clay color) with "poke" action to nudge the agent.
 * Duration shown in minutes.
 */
export function AgentStuckIndicator({
  agentRole,
  stuckDuration,
  onPoke,
  className,
}: AgentStuckIndicatorProps) {
  const durationText = stuckDuration < 60
    ? `${Math.floor(stuckDuration)} min`
    : `${Math.floor(stuckDuration / 60)}h ${Math.floor(stuckDuration % 60)}m`;

  return (
    <div
      className={cn(
        'bg-warning-light border-l-4 border-warning rounded-md p-3',
        'shadow-sm',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-warning mt-0.5">
          <ClockIcon size="md" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary">
              {agentRole} appears stuck
            </h3>
            <span className="text-xs text-text-muted font-mono">
              {durationText}
            </span>
          </div>

          <p className="text-sm text-text-secondary">
            No progress detected for an unusually long time.
          </p>

          {/* Poke Action */}
          {onPoke && (
            <button
              onClick={onPoke}
              className={cn(
                'inline-flex items-center gap-1.5 mt-3',
                'px-3 py-1.5 text-xs font-medium',
                'bg-warning hover:bg-warning/90 text-white',
                'rounded-md transition-colors',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-warning focus-visible:ring-offset-2'
              )}
            >
              <ZapIcon size="sm" />
              Poke Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
