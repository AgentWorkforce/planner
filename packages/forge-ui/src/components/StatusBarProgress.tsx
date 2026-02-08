/**
 * StatusBarProgress - Circular/mini progress indicator for status bar
 *
 * Shows:
 * - Circular progress indicator with percentage fill
 * - Task count text: '4/7 tasks'
 * - Animated fill for running state
 */

import { cn } from '@/lib/utils';
import { RunStatus } from '@/types';

interface StatusBarProgressProps {
  completedTasks: number;
  totalTasks: number;
  status: RunStatus;
  className?: string;
}

export function StatusBarProgress({
  completedTasks,
  totalTasks,
  status,
  className,
}: StatusBarProgressProps) {
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isRunning = status === RunStatus.RUNNING;
  const isFailed = status === RunStatus.FAILED;

  // SVG circle parameters
  const size = 20;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Circular progress indicator */}
      <div className="relative flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className={cn(isRunning && 'animate-pulse')}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-bg-deep"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              'transition-all duration-500 ease-out',
              isFailed ? 'text-error' : 'text-accent-cyan',
              '-rotate-90 origin-center'
            )}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
      </div>

      {/* Task count text */}
      <span className="text-xs font-medium text-text-secondary whitespace-nowrap">
        {completedTasks}/{totalTasks} tasks
      </span>

      {/* Percentage indicator */}
      <span className={cn(
        'text-xs font-mono tabular-nums',
        isFailed ? 'text-error' : 'text-text-muted'
      )}>
        {percentage}%
      </span>
    </div>
  );
}
