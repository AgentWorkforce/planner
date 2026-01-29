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
    <div className="execution-progress">
      <div className="execution-progress-bar">
        {donePercent > 0 && (
          <div
            className="execution-progress-segment execution-progress-segment--done"
            style={{ width: `${donePercent}%` }}
            title={`${progress.done} completed`}
          />
        )}
        {runningPercent > 0 && (
          <div
            className="execution-progress-segment execution-progress-segment--running"
            style={{ width: `${runningPercent}%` }}
            title={`${progress.running} running`}
          />
        )}
        {failedPercent > 0 && (
          <div
            className="execution-progress-segment execution-progress-segment--failed"
            style={{ width: `${failedPercent}%` }}
            title={`${progress.failed} failed`}
          />
        )}
        {blockedPercent > 0 && (
          <div
            className="execution-progress-segment execution-progress-segment--blocked"
            style={{ width: `${blockedPercent}%` }}
            title={`${progress.blocked} blocked`}
          />
        )}
      </div>

      <div className="execution-progress-text">
        {progress.done}/{total} steps complete
        {progress.running > 0 && ` • ${progress.running} running`}
        {progress.failed > 0 && ` • ${progress.failed} failed`}
        {progress.blocked > 0 && ` • ${progress.blocked} blocked`}
      </div>

      {showBreakdown && (
        <div className="execution-progress-breakdown">
          <div className="breakdown-item breakdown-done">
            <span className="breakdown-count">{progress.done}</span>
            <span className="breakdown-label">Done</span>
          </div>
          <div className="breakdown-item breakdown-running">
            <span className="breakdown-count">{progress.running}</span>
            <span className="breakdown-label">Running</span>
          </div>
          <div className="breakdown-item breakdown-pending">
            <span className="breakdown-count">{progress.pending}</span>
            <span className="breakdown-label">Pending</span>
          </div>
          <div className="breakdown-item breakdown-blocked">
            <span className="breakdown-count">{progress.blocked}</span>
            <span className="breakdown-label">Blocked</span>
          </div>
          {progress.failed > 0 && (
            <div className="breakdown-item breakdown-failed">
              <span className="breakdown-count">{progress.failed}</span>
              <span className="breakdown-label">Failed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
