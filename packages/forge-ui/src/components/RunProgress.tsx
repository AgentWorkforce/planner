/**
 * RunProgress - Progress bar with task completion status
 *
 * Shows:
 * - Animated progress bar with cyan accent
 * - Task completion count and percentage
 * - Elapsed time in HH:MM:SS format
 * - Status indicator (Running/Paused/Complete/Failed)
 */

import { cn } from '@/lib/utils';
import { RunStatus } from '@/types';

interface RunProgressProps {
  completedTasks: number;
  totalTasks: number;
  status: RunStatus;
  elapsedMs: number;
  className?: string;
}

/**
 * Format milliseconds to HH:MM:SS or MM:SS format
 */
function formatElapsedTime(ms: number): string {
  if (ms < 0) return '00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Get status label for display
 */
function getStatusLabel(status: RunStatus): string {
  switch (status) {
    case RunStatus.RUNNING:
      return 'Running';
    case RunStatus.PAUSED:
      return 'Paused';
    case RunStatus.COMPLETED:
      return 'Complete';
    case RunStatus.FAILED:
      return 'Failed';
    case RunStatus.PENDING:
      return 'Pending';
    case RunStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

/**
 * Get status indicator styles
 */
function getStatusStyles(status: RunStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case RunStatus.RUNNING:
      return {
        bg: 'bg-accent-light',
        text: 'text-accent-cyan',
        dot: 'bg-accent-cyan',
      };
    case RunStatus.PAUSED:
      return {
        bg: 'bg-warning-light',
        text: 'text-warning',
        dot: 'bg-warning',
      };
    case RunStatus.COMPLETED:
      return {
        bg: 'bg-success-light',
        text: 'text-success',
        dot: 'bg-success',
      };
    case RunStatus.FAILED:
      return {
        bg: 'bg-error-light',
        text: 'text-error',
        dot: 'bg-error',
      };
    case RunStatus.PENDING:
      return {
        bg: 'bg-bg-tertiary',
        text: 'text-text-muted',
        dot: 'bg-text-muted',
      };
    case RunStatus.CANCELLED:
      return {
        bg: 'bg-bg-tertiary',
        text: 'text-text-muted',
        dot: 'bg-text-muted',
      };
    default:
      return {
        bg: 'bg-bg-tertiary',
        text: 'text-text-muted',
        dot: 'bg-text-muted',
      };
  }
}

export function RunProgress({
  completedTasks,
  totalTasks,
  status,
  elapsedMs,
  className,
}: RunProgressProps) {
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isRunning = status === RunStatus.RUNNING;
  const statusStyles = getStatusStyles(status);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-bg-deep rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              status === RunStatus.FAILED ? 'bg-error' : 'bg-accent-cyan',
              isRunning && 'animate-pulse'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-sm">
        {/* Task count and percentage */}
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium">
            {completedTasks}/{totalTasks} tasks completed
          </span>
          <span className="text-text-muted">({percentage}%)</span>
        </div>

        {/* Elapsed time and status */}
        <div className="flex items-center gap-3">
          {/* Elapsed time */}
          <span className="text-text-secondary font-mono text-xs">
            {formatElapsedTime(elapsedMs)}
          </span>

          {/* Status indicator */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium',
              statusStyles.bg,
              statusStyles.text
            )}
          >
            {/* Pulsing dot for running status */}
            {isRunning ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
              </span>
            ) : (
              <span className={cn('h-1.5 w-1.5 rounded-full', statusStyles.dot)} />
            )}
            {getStatusLabel(status)}
          </span>
        </div>
      </div>
    </div>
  );
}
