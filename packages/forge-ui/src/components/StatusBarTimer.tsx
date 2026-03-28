/**
 * StatusBarTimer - Elapsed time display for status bar
 *
 * Shows:
 * - Clock icon with HH:MM:SS format
 * - Updates every second for running runs
 * - Shows 'Paused' when paused
 * - Static time for completed runs
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { RunStatus } from '@/types';

interface StatusBarTimerProps {
  startedAt?: string;
  completedAt?: string;
  status: RunStatus;
  className?: string;
}

/**
 * Format milliseconds to HH:MM:SS format
 */
function formatTime(ms: number): string {
  if (ms < 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Calculate elapsed time in milliseconds
 */
function calculateElapsedMs(startedAt?: string, completedAt?: string): number {
  if (!startedAt) return 0;

  const startTime = new Date(startedAt).getTime();
  const endTime = completedAt ? new Date(completedAt).getTime() : Date.now();

  return Math.max(0, endTime - startTime);
}

export function StatusBarTimer({
  startedAt,
  completedAt,
  status,
  className,
}: StatusBarTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(() =>
    calculateElapsedMs(startedAt, completedAt)
  );
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isRunning = status === RunStatus.RUNNING;
  const isPaused = status === RunStatus.PAUSED;

  // Update timer every second for running runs
  useEffect(() => {
    if (isRunning && startedAt) {
      // Initial calculation
      setElapsedMs(calculateElapsedMs(startedAt, completedAt));

      // Update every second
      intervalRef.current = setInterval(() => {
        setElapsedMs(calculateElapsedMs(startedAt, completedAt));
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Static time for non-running states
      setElapsedMs(calculateElapsedMs(startedAt, completedAt));
    }
  }, [isRunning, startedAt, completedAt]);

  // Don't show timer if not started
  if (!startedAt) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Clock icon */}
      <ClockIcon
        className={cn(
          'h-4 w-4',
          isRunning ? 'text-accent-cyan' : 'text-text-muted'
        )}
      />

      {/* Time display or Paused label */}
      {isPaused ? (
        <span className="text-xs font-medium text-amber-500">Paused</span>
      ) : (
        <span
          className={cn(
            'text-xs font-mono tabular-nums',
            isRunning ? 'text-text-primary' : 'text-text-secondary'
          )}
        >
          {formatTime(elapsedMs)}
        </span>
      )}
    </div>
  );
}

/**
 * Clock icon
 */
function ClockIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
