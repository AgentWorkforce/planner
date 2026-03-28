import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { AlertIcon } from '@/components/icons';

/**
 * StepFailureState - Error state for failed steps
 *
 * Shown in step detail or tree when a step execution fails.
 */
export function StepFailureState({
  stepTitle,
  error,
  onRetry,
  onViewLog,
}: {
  stepTitle: string;
  error: string;
  onRetry?: () => void;
  onViewLog?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-lg',
        'bg-error-light border-l-4 border-l-accent-secondary'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <AlertIcon size="md" className="text-accent-secondary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text-primary">Step Failed</h4>
          <p className="text-xs text-text-muted mt-0.5">{stepTitle}</p>
        </div>
      </div>

      {/* Error message */}
      <p className="text-sm text-text-secondary bg-bg-secondary px-3 py-2 rounded border border-border-subtle font-mono">
        {error}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Retry Step
          </Button>
        )}
        {onViewLog && (
          <Button variant="ghost" size="sm" onClick={onViewLog}>
            View Log
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * RunFailureState - Error state for failed runs
 *
 * Shown in project view during forging phase when a run fails.
 */
export function RunFailureState({
  runId,
  error,
  failedStep,
  onRetry,
  onAbort,
}: {
  runId: string;
  error: string;
  failedStep?: string;
  onRetry?: () => void;
  onAbort?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-lg',
        'bg-error-light border-l-4 border-l-accent-secondary'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <AlertIcon size="lg" className="text-accent-secondary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-text-primary">Run Failed</h3>
          <p className="text-xs text-text-muted mt-0.5">Run ID: {runId}</p>
          {failedStep && (
            <p className="text-xs text-text-muted mt-0.5">Failed at: {failedStep}</p>
          )}
        </div>
      </div>

      {/* Error message */}
      <div className="bg-bg-secondary px-3 py-2 rounded border border-border-subtle">
        <p className="text-sm text-text-secondary font-mono">{error}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Retry Run
          </Button>
        )}
        {onAbort && (
          <Button variant="danger" size="sm" onClick={onAbort}>
            Abort Run
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * ConnectionLostBanner - Banner for connection loss
 *
 * Shown as banner or overlay when connection to backend is lost.
 */
export function ConnectionLostBanner({
  reconnecting,
  attemptCount,
  onManualReconnect,
}: {
  reconnecting: boolean;
  attemptCount: number;
  onManualReconnect?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 gap-3',
        'bg-warning-light border-l-4 border-l-warning'
      )}
    >
      {/* Icon and message */}
      <div className="flex items-center gap-2">
        <span className="text-warning text-lg">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {reconnecting ? 'Reconnecting...' : 'Connection Lost'}
          </p>
          {reconnecting && (
            <p className="text-xs text-text-muted">Attempt {attemptCount}</p>
          )}
        </div>
      </div>

      {/* Reconnect spinner or manual button */}
      {reconnecting ? (
        <div className="w-4 h-4 border-2 border-warning border-t-transparent rounded-full animate-spin" />
      ) : (
        onManualReconnect && (
          <Button variant="primary" size="sm" onClick={onManualReconnect}>
            Reconnect
          </Button>
        )
      )}
    </div>
  );
}

/**
 * AgentStuckState - Error state for stuck agents
 *
 * Shown in agent detail or status bar when an agent hasn't progressed.
 */
export function AgentStuckState({
  agentName,
  duration,
  lastAction,
  onNudge,
  onKill,
}: {
  agentName: string;
  duration: string;
  lastAction?: string;
  onNudge?: () => void;
  onKill?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-lg',
        'bg-warning-light border-l-4 border-l-warning'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <span className="text-warning text-lg shrink-0">⏳</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text-primary">Agent Stuck</h4>
          <p className="text-xs text-text-muted mt-0.5">{agentName}</p>
        </div>
      </div>

      {/* Details */}
      <div className="text-xs text-text-secondary space-y-1">
        <p>No progress for {duration}</p>
        {lastAction && <p className="text-text-muted">Last action: {lastAction}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onNudge && (
          <Button variant="primary" size="sm" onClick={onNudge}>
            Nudge Agent
          </Button>
        )}
        {onKill && (
          <Button variant="danger" size="sm" onClick={onKill}>
            Kill Agent
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * EmptyState - Generic empty state component
 *
 * Used throughout the app for empty lists, no data, etc.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Icon */}
      {icon && <span className="text-4xl mb-4">{icon}</span>}

      {/* Title */}
      <h3 className="text-base font-semibold text-text-primary mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-muted max-w-sm mb-4">{description}</p>
      )}

      {/* Action button */}
      {action && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}
