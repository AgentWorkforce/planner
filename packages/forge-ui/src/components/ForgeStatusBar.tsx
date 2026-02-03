/**
 * ForgeStatusBar - Global status bar showing active run information
 *
 * Features:
 * - Fixed bottom position, full width
 * - Sections: Run Name | Progress | Agents | Gates | Questions | Timer
 * - Collapsed (h-8) and expanded (h-12) states
 * - Hidden when no active run
 * - Click navigates to /forge/runs/:activeRunId
 * - Ctrl/Cmd+click opens new tab
 * - Multi-run indicator: '+N running' badge
 * - Collapse state persisted to localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { RunStatus } from '@/types';
import { useActiveRun } from '@/hooks/useActiveRun';
import { useActiveAgents } from '@/hooks/useActiveAgents';
import { usePendingGates } from '@/hooks/usePendingGates';
import { useQuestions } from '@/hooks/useQuestions';
import { StatusBarProgress } from './StatusBarProgress';
import { StatusBarAgents } from './StatusBarAgents';
import { StatusBarGates } from './StatusBarGates';
import { StatusBarTimer } from './StatusBarTimer';
import { StatusBarQuestions } from './StatusBarQuestions';

const STORAGE_KEY = 'forge.statusBarCollapsed';

interface ForgeStatusBarProps {
  /** Called when gates indicator is clicked */
  onGatesClick?: () => void;
  /** Called when questions indicator is clicked */
  onQuestionsClick?: () => void;
  className?: string;
}

/**
 * Get status indicator styles
 */
function getStatusStyles(status: RunStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case RunStatus.RUNNING:
      return {
        bg: 'bg-accent-cyan/10',
        text: 'text-accent-cyan',
        dot: 'bg-accent-cyan',
      };
    case RunStatus.PAUSED:
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-500',
        dot: 'bg-amber-500',
      };
    case RunStatus.COMPLETED:
      return {
        bg: 'bg-success/10',
        text: 'text-success',
        dot: 'bg-success',
      };
    case RunStatus.FAILED:
      return {
        bg: 'bg-error/10',
        text: 'text-error',
        dot: 'bg-error',
      };
    case RunStatus.PENDING:
    case RunStatus.CANCELLED:
    default:
      return {
        bg: 'bg-text-muted/10',
        text: 'text-text-muted',
        dot: 'bg-text-muted',
      };
  }
}

/**
 * Get status label
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

export function ForgeStatusBar({
  onGatesClick,
  onQuestionsClick,
  className,
}: ForgeStatusBarProps) {
  const navigate = useNavigate();

  // Get active run and related data
  const { activeRun, isLoading, otherRunningCount } = useActiveRun();
  const { agents } = useActiveAgents(activeRun?.run_id);
  const { gates } = usePendingGates({ runId: activeRun?.run_id, enabled: !!activeRun });
  const { questions } = useQuestions({ runId: activeRun?.run_id, enabled: !!activeRun });

  // Collapse state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist collapse state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
      // Ignore localStorage errors
    }
  }, [isCollapsed]);

  // Handle click to navigate
  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      if (!activeRun) return;

      const url = `/forge/runs/${activeRun.run_id}`;

      // Ctrl/Cmd+click opens new tab
      if (e.metaKey || e.ctrlKey) {
        window.open(url, '_blank');
      } else {
        navigate(url);
      }
    },
    [activeRun, navigate]
  );

  // Toggle collapse state
  const toggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed((prev) => !prev);
  }, []);

  // Don't render if loading or no active run
  if (isLoading || !activeRun) {
    return null;
  }

  const statusStyles = getStatusStyles(activeRun.status);
  const isRunning = activeRun.status === RunStatus.RUNNING;

  return (
    <div
      onClick={handleBarClick}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-bg-surface border-t border-border',
        'transition-all duration-200 ease-out cursor-pointer',
        'hover:bg-bg-elevated',
        isCollapsed ? 'h-8' : 'h-12',
        className
      )}
    >
      <div
        className={cn(
          'h-full flex items-center px-4 gap-4',
          'max-w-full overflow-hidden'
        )}
      >
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className={cn(
            'flex-shrink-0 p-1 rounded hover:bg-bg-tertiary',
            'text-text-muted hover:text-text-secondary',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-accent-cyan/50'
          )}
          title={isCollapsed ? 'Expand status bar' : 'Collapse status bar'}
        >
          <ChevronIcon
            className={cn(
              'h-4 w-4 transition-transform',
              isCollapsed ? 'rotate-180' : ''
            )}
          />
        </button>

        {/* Run name and status */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          {/* Status indicator dot */}
          <span
            className={cn(
              'h-2 w-2 rounded-full flex-shrink-0',
              statusStyles.dot,
              isRunning && 'animate-pulse'
            )}
          />

          {/* Run name/goal */}
          <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
            {activeRun.plan_goal || `Run ${activeRun.run_id.slice(0, 8)}`}
          </span>

          {/* Status badge (only in expanded mode) */}
          {!isCollapsed && (
            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded',
                statusStyles.bg,
                statusStyles.text
              )}
            >
              {getStatusLabel(activeRun.status)}
            </span>
          )}

          {/* Multi-run indicator */}
          {otherRunningCount > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">
              +{otherRunningCount} running
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-border flex-shrink-0" />

        {/* Progress */}
        <StatusBarProgress
          completedTasks={activeRun.completed_tasks}
          totalTasks={activeRun.total_tasks}
          status={activeRun.status}
          className="flex-shrink-0"
        />

        {/* Expanded-only sections */}
        {!isCollapsed && (
          <>
            {/* Separator */}
            <div className="h-4 w-px bg-border flex-shrink-0" />

            {/* Agents */}
            <StatusBarAgents agents={agents} className="flex-shrink-0" />
          </>
        )}

        {/* Gates (always visible when present) */}
        <StatusBarGates
          count={gates.length}
          onClick={onGatesClick}
          className="flex-shrink-0"
        />

        {/* Questions (always visible when present) */}
        <StatusBarQuestions
          questions={questions}
          onClick={onQuestionsClick}
          className="flex-shrink-0"
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Timer */}
        <StatusBarTimer
          startedAt={activeRun.started_at}
          completedAt={activeRun.completed_at}
          status={activeRun.status}
          className="flex-shrink-0"
        />
      </div>
    </div>
  );
}

/**
 * Chevron icon for collapse toggle
 */
function ChevronIcon({ className }: { className?: string }) {
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
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
