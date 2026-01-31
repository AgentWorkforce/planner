import type { ExecutionStatus } from '@/types';

interface ExecutionProgressProps {
  execution: ExecutionStatus;
  showBreakdown?: boolean;
}

/**
 * Progress bar and stats showing execution progress.
 */
export function ExecutionProgress({ execution, showBreakdown = false }: ExecutionProgressProps) {
  const { progress } = execution;
  const total = progress.total;

  // Calculate percentages for progress bar segments
  const donePercent = total > 0 ? (progress.done / total) * 100 : 0;
  const runningPercent = total > 0 ? (progress.running / total) * 100 : 0;
  const failedPercent = total > 0 ? (progress.failed / total) * 100 : 0;
  const blockedPercent = total > 0 ? (progress.blocked / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden flex">
        {donePercent > 0 && (
          <div
            className="h-full bg-success transition-all duration-300"
            style={{ width: `${donePercent}%` }}
            title={`${progress.done} completed`}
          />
        )}
        {runningPercent > 0 && (
          <div
            className="h-full bg-accent-cyan animate-pulse transition-all duration-300"
            style={{ width: `${runningPercent}%` }}
            title={`${progress.running} running`}
          />
        )}
        {failedPercent > 0 && (
          <div
            className="h-full bg-error transition-all duration-300"
            style={{ width: `${failedPercent}%` }}
            title={`${progress.failed} failed`}
          />
        )}
        {blockedPercent > 0 && (
          <div
            className="h-full bg-warning transition-all duration-300"
            style={{ width: `${blockedPercent}%` }}
            title={`${progress.blocked} blocked`}
          />
        )}
      </div>

      <div className="text-sm text-text-secondary">
        <span className="text-text-primary font-medium">{progress.done}/{total}</span> steps complete
        {progress.running > 0 && (
          <span className="text-accent-cyan"> · {progress.running} running</span>
        )}
        {progress.failed > 0 && (
          <span className="text-error"> · {progress.failed} failed</span>
        )}
        {progress.blocked > 0 && (
          <span className="text-warning"> · {progress.blocked} blocked</span>
        )}
      </div>

      {showBreakdown && (
        <div className="flex gap-4 pt-2 border-t border-border-subtle">
          <div className="text-center">
            <div className="text-lg font-semibold text-success">{progress.done}</div>
            <div className="text-xs text-text-muted">Done</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-accent-cyan">{progress.running}</div>
            <div className="text-xs text-text-muted">Running</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-text-secondary">{progress.pending}</div>
            <div className="text-xs text-text-muted">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-warning">{progress.blocked}</div>
            <div className="text-xs text-text-muted">Blocked</div>
          </div>
          {progress.failed > 0 && (
            <div className="text-center">
              <div className="text-lg font-semibold text-error">{progress.failed}</div>
              <div className="text-xs text-text-muted">Failed</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
