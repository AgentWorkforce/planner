/**
 * TimelineFilter - Filter tabs for timeline events
 *
 * Displays tabs for filtering timeline events by category with count badges.
 * Categories: All, Tasks, Agents, Gates, Questions
 */

import { cn } from '@/lib/utils';
import type { TimelineFilterType, TimelineEventCounts } from '@/types';

interface TimelineFilterProps {
  activeFilter: TimelineFilterType;
  counts: TimelineEventCounts;
  onChange: (filter: TimelineFilterType) => void;
  className?: string;
}

interface TabConfig {
  value: TimelineFilterType;
  label: string;
  activeColor: string;
  activeBg: string;
}

const tabs: TabConfig[] = [
  {
    value: 'all',
    label: 'All',
    activeColor: 'text-accent-cyan',
    activeBg: 'bg-accent-cyan/10',
  },
  {
    value: 'tasks',
    label: 'Tasks',
    activeColor: 'text-success',
    activeBg: 'bg-success/10',
  },
  {
    value: 'agents',
    label: 'Agents',
    activeColor: 'text-accent-purple',
    activeBg: 'bg-accent-purple/10',
  },
  {
    value: 'gates',
    label: 'Gates',
    activeColor: 'text-warning',
    activeBg: 'bg-warning/10',
  },
  {
    value: 'questions',
    label: 'Questions',
    activeColor: 'text-info',
    activeBg: 'bg-info/10',
  },
];

export function TimelineFilter({
  activeFilter,
  counts,
  onChange,
  className,
}: TimelineFilterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-bg-tertiary rounded-lg',
        className
      )}
      role="tablist"
      aria-label="Filter timeline events"
    >
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.value;
        const count = counts[tab.value];

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
                  isActive ? tab.activeBg : 'bg-bg-secondary text-text-muted'
                )}
              >
                {count > 999 ? '999+' : count}
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
export function getDefaultEventCounts(): TimelineEventCounts {
  return {
    all: 0,
    tasks: 0,
    agents: 0,
    gates: 0,
    questions: 0,
  };
}
