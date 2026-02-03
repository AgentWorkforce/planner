/**
 * RunCard - Display card for a run in the runs list
 *
 * Shows status badge, plan goal, task progress, and duration.
 * Clickable card navigates to the run detail page.
 */

import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { RunStatus, type RunSummary } from '@/types';

interface RunCardProps {
  run: RunSummary;
  className?: string;
}

/**
 * Get status badge styles based on run status.
 */
function getStatusBadgeStyles(status: RunStatus): { bg: string; text: string } {
  switch (status) {
    case RunStatus.RUNNING:
      return { bg: 'rgba(0, 217, 255, 0.1)', text: '#00d9ff' }; // accent-cyan / blue
    case RunStatus.COMPLETED:
      return { bg: 'rgba(0, 255, 200, 0.1)', text: '#00ffc8' }; // success / green
    case RunStatus.FAILED:
      return { bg: 'rgba(255, 71, 87, 0.1)', text: '#ff4757' }; // error / red
    case RunStatus.PAUSED:
      return { bg: 'rgba(255, 193, 7, 0.1)', text: '#ffc107' }; // warning / yellow
    case RunStatus.PENDING:
      return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8' }; // text-secondary / gray
    case RunStatus.CANCELLED:
      return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8' }; // text-secondary / gray
    default:
      return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8' };
  }
}

/**
 * Get accent bar color class based on status.
 */
function getAccentBarClass(status: RunStatus): string {
  switch (status) {
    case RunStatus.RUNNING:
      return 'bg-accent-cyan';
    case RunStatus.COMPLETED:
      return 'bg-success';
    case RunStatus.FAILED:
      return 'bg-error';
    case RunStatus.PAUSED:
      return 'bg-warning';
    case RunStatus.PENDING:
      return 'bg-border-subtle';
    case RunStatus.CANCELLED:
      return 'bg-border-subtle';
    default:
      return 'bg-border-subtle';
  }
}

/**
 * Get hover glow effect based on status.
 */
function getHoverGlowClass(status: RunStatus): string {
  switch (status) {
    case RunStatus.RUNNING:
      return 'hover:shadow-[0_0_16px_rgba(0,217,255,0.15)]';
    case RunStatus.COMPLETED:
      return 'hover:shadow-[0_0_16px_rgba(0,255,200,0.12)]';
    case RunStatus.FAILED:
      return 'hover:shadow-[0_0_16px_rgba(255,71,87,0.12)]';
    case RunStatus.PAUSED:
      return 'hover:shadow-[0_0_16px_rgba(255,193,7,0.12)]';
    default:
      return '';
  }
}

/**
 * Format duration between two timestamps or elapsed time for running runs.
 */
function formatDuration(startedAt?: string, endedAt?: string): string {
  if (!startedAt) return '--';

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const durationMs = end - start;

  if (durationMs < 0) return '--';

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get human-readable status label.
 */
function getStatusLabel(status: RunStatus): string {
  switch (status) {
    case RunStatus.RUNNING:
      return 'Running';
    case RunStatus.COMPLETED:
      return 'Completed';
    case RunStatus.FAILED:
      return 'Failed';
    case RunStatus.PAUSED:
      return 'Paused';
    case RunStatus.PENDING:
      return 'Pending';
    case RunStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

export function RunCard({ run, className }: RunCardProps) {
  const isRunning = run.status === RunStatus.RUNNING;
  const isTerminal =
    run.status === RunStatus.COMPLETED ||
    run.status === RunStatus.FAILED ||
    run.status === RunStatus.CANCELLED;

  // Calculate progress percentage
  const progressPercent =
    run.total_tasks > 0
      ? Math.round((run.completed_tasks / run.total_tasks) * 100)
      : 0;

  return (
    <Link
      to={`/forge/runs/${run.run_id}`}
      className={cn(
        'group relative block bg-bg-card border border-border-subtle rounded-xl pl-5 pr-4 py-4',
        'hover:border-border-light hover:bg-bg-hover/50 transition-all duration-150',
        getHoverGlowClass(run.status),
        className
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 w-[3px] rounded-full',
          getAccentBarClass(run.status)
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Plan goal */}
          <h2 className="font-medium text-text-primary group-hover:text-accent-cyan transition-colors truncate mb-2">
            {run.plan_goal || 'Untitled Run'}
          </h2>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
              <span>
                {run.completed_tasks}/{run.total_tasks} tasks
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  run.status === RunStatus.FAILED ? 'bg-error' : 'bg-success'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 text-sm text-text-muted">
            {/* Duration */}
            <span className="flex items-center gap-1">
              <ClockIcon />
              {isRunning
                ? formatDuration(run.started_at)
                : isTerminal
                  ? formatDuration(run.started_at, run.started_at ? new Date().toISOString() : undefined)
                  : '--'}
            </span>
            <span className="text-text-dim">|</span>
            {/* Created date */}
            <span>{new Date(run.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status badge */}
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: getStatusBadgeStyles(run.status).bg,
              color: getStatusBadgeStyles(run.status).text,
            }}
          >
            {isRunning && <PulsingDot />}
            {getStatusLabel(run.status)}
          </span>
          {/* Chevron */}
          <ChevronRightIcon />
        </div>
      </div>
    </Link>
  );
}

/**
 * Inline clock icon for duration.
 */
function ClockIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * Pulsing dot indicator for running status.
 */
function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2 mr-1.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
    </span>
  );
}

/**
 * Chevron right icon for navigation hint.
 */
function ChevronRightIcon() {
  return (
    <svg
      className="h-4 w-4 text-text-muted group-hover:text-accent-cyan transition-colors"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
