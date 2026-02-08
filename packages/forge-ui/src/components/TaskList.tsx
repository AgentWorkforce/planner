/**
 * TaskList - List of tasks for a run with grouping and auto-scroll
 *
 * Features:
 * - Groups tasks by scope for multi-scope plans
 * - Auto-scrolls to currently running task
 * - Handles empty state
 */

import { useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TaskItem } from '@/components/TaskItem';
import { EmptyState } from '@/components/EmptyState';
import { TaskStatus, type Task } from '@/types';

interface TaskListProps {
  tasks: Task[];
  className?: string;
}

/**
 * Group tasks by scope
 */
function groupTasksByScope(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const scope = task.scope || 'default';
    const existing = groups.get(scope) || [];
    groups.set(scope, [...existing, task]);
  }

  return groups;
}

/**
 * Check if tasks span multiple scopes
 */
function isMultiScope(tasks: Task[]): boolean {
  const scopes = new Set(tasks.map((t) => t.scope || 'default'));
  return scopes.size > 1;
}

/**
 * Find the currently running task
 */
function findRunningTask(tasks: Task[]): Task | undefined {
  return tasks.find(
    (t) => t.status === TaskStatus.RUNNING || t.status === TaskStatus.ASSIGNED
  );
}

export function TaskList({ tasks, className }: TaskListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runningTaskRef = useRef<HTMLDivElement>(null);

  const multiScope = useMemo(() => isMultiScope(tasks), [tasks]);
  const groupedTasks = useMemo(() => groupTasksByScope(tasks), [tasks]);
  const runningTask = useMemo(() => findRunningTask(tasks), [tasks]);

  // Auto-scroll to running task
  useEffect(() => {
    if (runningTask && runningTaskRef.current && containerRef.current) {
      // Smooth scroll the running task into view
      runningTaskRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [runningTask?.task_id]);

  // Empty state
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        }
        title="No tasks"
        description="Tasks will appear here once the run starts."
        className={className}
      />
    );
  }

  // Single scope view (flat list)
  if (!multiScope) {
    return (
      <div ref={containerRef} className={cn('space-y-1', className)}>
        {tasks.map((task) => (
          <div
            key={task.task_id}
            ref={task.task_id === runningTask?.task_id ? runningTaskRef : undefined}
          >
            <TaskItem task={task} isMultiScope={false} />
          </div>
        ))}
      </div>
    );
  }

  // Multi-scope view (grouped)
  return (
    <div ref={containerRef} className={cn('space-y-4', className)}>
      {Array.from(groupedTasks.entries()).map(([scope, scopeTasks]) => (
        <div key={scope} className="space-y-1">
          {/* Scope header */}
          <div className="flex items-center gap-2 px-3 py-1.5 sticky top-0 bg-bg-secondary/95 backdrop-blur-sm z-10">
            <span className="text-xs font-medium text-accent-purple uppercase tracking-wide">
              {scope}
            </span>
            <span className="text-xs text-text-muted">
              ({scopeTasks.filter((t) => t.status === TaskStatus.COMPLETED).length}/{scopeTasks.length})
            </span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          {/* Tasks in scope */}
          <div className="space-y-1">
            {scopeTasks.map((task) => (
              <div
                key={task.task_id}
                ref={task.task_id === runningTask?.task_id ? runningTaskRef : undefined}
              >
                <TaskItem task={task} isMultiScope={true} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
