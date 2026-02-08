/**
 * RunHeader - Header component for the run dashboard
 *
 * Features:
 * - Breadcrumb navigation: Runs > Run [short-id]
 * - Plan goal as title
 * - RunProgress component showing task completion
 * - RunControls on the right side
 */

import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { RunProgress } from '@/components/RunProgress';
import { RunControls } from '@/components/RunControls';
import type { Run } from '@/types';

interface RunHeaderProps {
  run: Run;
  elapsedMs: number;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  className?: string;
}

/**
 * Shorten a UUID for display
 */
function shortenId(id: string): string {
  return id.slice(0, 8);
}

export function RunHeader({
  run,
  elapsedMs,
  onPause,
  onResume,
  onCancel,
  className,
}: RunHeaderProps) {
  return (
    <div className={cn('border-b border-border-subtle px-6 py-4', className)}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-3">
        <Link
          to="/forge/runs"
          className="text-text-muted hover:text-accent-cyan transition-colors"
        >
          Runs
        </Link>
        <ChevronIcon />
        <span className="text-text-secondary font-mono">
          {shortenId(run.run_id)}
        </span>
      </nav>

      {/* Main header row */}
      <div className="flex items-start justify-between gap-4">
        {/* Left side: title and progress */}
        <div className="flex-1 min-w-0">
          {/* Plan goal / title */}
          <h1 className="text-2xl font-display font-semibold text-text-primary truncate mb-3">
            {run.plan_goal || 'Untitled Run'}
          </h1>

          {/* Progress bar */}
          <RunProgress
            completedTasks={run.tasks_completed ?? run.completed_tasks ?? 0}
            totalTasks={run.tasks_count ?? run.total_tasks ?? 0}
            status={run.status}
            elapsedMs={elapsedMs}
          />
        </div>

        {/* Right side: controls */}
        <div className="flex-shrink-0">
          <RunControls
            runId={run.run_id}
            status={run.status}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Chevron icon for breadcrumb separator
 */
function ChevronIcon() {
  return (
    <svg
      className="h-4 w-4 text-text-muted"
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

/**
 * Skeleton version for loading state
 */
export function RunHeaderSkeleton() {
  return (
    <div className="border-b border-border-subtle px-6 py-4">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-12 bg-bg-tertiary rounded animate-pulse" />
        <ChevronIcon />
        <div className="h-4 w-20 bg-bg-tertiary rounded animate-pulse" />
      </div>

      {/* Main content */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Title skeleton */}
          <div className="h-8 w-64 bg-bg-tertiary rounded animate-pulse mb-3" />

          {/* Progress skeleton */}
          <div className="space-y-2">
            <div className="h-2 w-full bg-bg-tertiary rounded-full animate-pulse" />
            <div className="flex justify-between">
              <div className="h-4 w-32 bg-bg-tertiary rounded animate-pulse" />
              <div className="h-4 w-24 bg-bg-tertiary rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Controls skeleton */}
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-9 w-20 bg-bg-tertiary rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
