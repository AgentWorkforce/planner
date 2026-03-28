/**
 * StatusFilterTabs - Filter runs by status
 *
 * Displays tabs for filtering runs by status with count badges.
 * Active tab updates URL query param.
 */

import { cn } from '@/lib/utils';
import { RunStatus } from '@/types';

export type StatusFilter = RunStatus | 'all';

interface StatusCount {
  all: number;
  running: number;
  completed: number;
  failed: number;
  paused: number;
  pending: number;
}

interface StatusFilterTabsProps {
  activeFilter: StatusFilter;
  counts: StatusCount;
  onChange: (filter: StatusFilter) => void;
  className?: string;
}

interface TabConfig {
  value: StatusFilter;
  label: string;
  countKey: keyof StatusCount;
  activeColor: string;
  activeBg: string;
}

const tabs: TabConfig[] = [
  {
    value: 'all',
    label: 'All',
    countKey: 'all',
    activeColor: 'text-accent-cyan',
    activeBg: 'bg-accent-cyan/10',
  },
  {
    value: RunStatus.RUNNING,
    label: 'Running',
    countKey: 'running',
    activeColor: 'text-accent-cyan',
    activeBg: 'bg-accent-cyan/10',
  },
  {
    value: RunStatus.COMPLETED,
    label: 'Completed',
    countKey: 'completed',
    activeColor: 'text-success',
    activeBg: 'bg-success/10',
  },
  {
    value: RunStatus.FAILED,
    label: 'Failed',
    countKey: 'failed',
    activeColor: 'text-error',
    activeBg: 'bg-error/10',
  },
  {
    value: RunStatus.PAUSED,
    label: 'Paused',
    countKey: 'paused',
    activeColor: 'text-warning',
    activeBg: 'bg-warning/10',
  },
];

export function StatusFilterTabs({
  activeFilter,
  counts,
  onChange,
  className,
}: StatusFilterTabsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-bg-tertiary rounded-lg',
        className
      )}
      role="tablist"
      aria-label="Filter runs by status"
    >
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.value;
        const count = counts[tab.countKey];

        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-1',
              isActive
                ? cn('bg-bg-card shadow-sm', tab.activeColor)
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold',
                  isActive
                    ? tab.activeBg
                    : 'bg-bg-secondary text-text-muted'
                )}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Default counts object with all zeros.
 */
export function getDefaultStatusCounts(): StatusCount {
  return {
    all: 0,
    running: 0,
    completed: 0,
    failed: 0,
    paused: 0,
    pending: 0,
  };
}

/**
 * Calculate status counts from a list of runs.
 */
export function calculateStatusCounts(
  runs: Array<{ status: RunStatus }>
): StatusCount {
  const counts = getDefaultStatusCounts();
  counts.all = runs.length;

  for (const run of runs) {
    switch (run.status) {
      case RunStatus.RUNNING:
        counts.running++;
        break;
      case RunStatus.COMPLETED:
        counts.completed++;
        break;
      case RunStatus.FAILED:
        counts.failed++;
        break;
      case RunStatus.PAUSED:
        counts.paused++;
        break;
      case RunStatus.PENDING:
        counts.pending++;
        break;
    }
  }

  return counts;
}
