/**
 * TaskItem - Individual task display in the run dashboard
 *
 * Shows:
 * - Status icon for each state
 * - Task title with optional scope badge
 * - Duration for completed/running tasks
 * - Expandable section with description, artifacts, dependencies
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TaskStatus, type Task, type Artifact } from '@/types';
import { ArtifactItemCompact } from './ArtifactItem';

interface TaskItemProps {
  task: Task;
  artifacts?: Artifact[];
  isMultiScope?: boolean;
  className?: string;
}

/**
 * Format duration between two timestamps
 */
function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '--';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
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
 * Get status icon component
 */
function StatusIcon({ status }: { status: TaskStatus }) {
  const iconClass = 'h-4 w-4';

  switch (status) {
    case TaskStatus.PENDING:
    case TaskStatus.BLOCKED:
      return (
        <svg className={cn(iconClass, 'text-text-muted')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case TaskStatus.READY:
      return (
        <svg className={cn(iconClass, 'text-text-secondary')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case TaskStatus.ASSIGNED:
    case TaskStatus.RUNNING:
      return (
        <div className="relative">
          <svg className={cn(iconClass, 'text-accent-cyan animate-spin')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      );
    case TaskStatus.COMPLETED:
      return (
        <svg className={cn(iconClass, 'text-success')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case TaskStatus.FAILED:
      return (
        <svg className={cn(iconClass, 'text-error')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case TaskStatus.SKIPPED:
      return (
        <svg className={cn(iconClass, 'text-text-muted')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      );
    default:
      return (
        <svg className={cn(iconClass, 'text-text-muted')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

/**
 * Get status-specific background color for the item
 */
function getStatusBgClass(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.RUNNING:
    case TaskStatus.ASSIGNED:
      return 'bg-accent-light/50';
    case TaskStatus.COMPLETED:
      return 'hover:bg-success-light/30';
    case TaskStatus.FAILED:
      return 'bg-error-light/30';
    default:
      return 'hover:bg-bg-hover';
  }
}

/**
 * Get status-specific border color
 */
function getStatusBorderClass(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.RUNNING:
    case TaskStatus.ASSIGNED:
      return 'border-l-accent-cyan';
    case TaskStatus.COMPLETED:
      return 'border-l-success';
    case TaskStatus.FAILED:
      return 'border-l-error';
    default:
      return 'border-l-transparent';
  }
}

export function TaskItem({ task, artifacts = [], isMultiScope = false, className }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRunning = task.status === TaskStatus.RUNNING || task.status === TaskStatus.ASSIGNED;
  const showDuration = isRunning || task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED;
  const hasArtifacts = artifacts.length > 0 || (task.result?.artifacts && task.result.artifacts.length > 0);
  const hasExpandedContent = task.description || (task.dependencies && task.dependencies.length > 0) || hasArtifacts;

  return (
    <div
      className={cn(
        'border-l-2 transition-colors',
        getStatusBorderClass(task.status),
        getStatusBgClass(task.status),
        hasExpandedContent && 'cursor-pointer',
        className
      )}
      onClick={() => hasExpandedContent && setIsExpanded(!isExpanded)}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Status icon */}
        <StatusIcon status={task.status} />

        {/* Task title and scope */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm truncate',
              task.status === TaskStatus.COMPLETED ? 'text-text-secondary' : 'text-text-primary'
            )}>
              {task.title}
            </span>
            {isMultiScope && task.scope && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-purple/20 text-accent-purple">
                {task.scope}
              </span>
            )}
          </div>
        </div>

        {/* Duration */}
        {showDuration && (
          <span className="text-xs text-text-muted font-mono flex-shrink-0">
            {formatDuration(task.started_at, task.completed_at)}
          </span>
        )}

        {/* Expand indicator */}
        {hasExpandedContent && (
          <svg
            className={cn(
              'h-4 w-4 text-text-muted transition-transform flex-shrink-0',
              isExpanded && 'rotate-90'
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && hasExpandedContent && (
        <div className="px-3 pb-3 pl-10 space-y-2 text-sm">
          {/* Description */}
          {task.description && (
            <p className="text-text-secondary">{task.description}</p>
          )}

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wide">Dependencies:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-bg-tertiary text-text-secondary"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rich Artifacts (with full artifact data) */}
          {artifacts.length > 0 && (
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wide">Artifacts:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {artifacts.map((artifact) => (
                  <ArtifactItemCompact key={artifact.artifact_id} artifact={artifact} />
                ))}
              </div>
            </div>
          )}

          {/* Legacy Artifacts (just IDs from task.result) */}
          {artifacts.length === 0 && task.result?.artifacts && task.result.artifacts.length > 0 && (
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wide">Artifacts:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.result.artifacts.map((artifactId) => (
                  <span
                    key={artifactId}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-accent-light text-accent-cyan"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {artifactId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error message for failed tasks */}
          {task.status === TaskStatus.FAILED && task.result?.error && (
            <div className="p-2 rounded bg-error-light border border-error/20">
              <span className="text-error text-xs">{task.result.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
