/**
 * TimelinePage - Timeline view for a run
 *
 * Features:
 * - Header with breadcrumb navigation back to run dashboard
 * - TimelineFilter toolbar for filtering events by category
 * - TimelineExportButton for exporting timeline data
 * - TimelineList as main content with virtualized rendering
 * - URL param persistence for active filter
 * - SSE subscription for running runs to receive live events
 */

import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTimeline } from '@/hooks/useTimeline';
import { useRun } from '@/hooks/useRun';
import { TimelineFilter, getDefaultEventCounts } from '@/components/TimelineFilter';
import { TimelineList } from '@/components/TimelineList';
import { TimelineExportButton } from '@/components/TimelineExportButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { TimelineIcon } from '@/components/icons';
import { RunStatus, type TimelineFilterType } from '@/types';

/**
 * Parse filter from URL search params
 */
function parseFilterParam(param: string | null): TimelineFilterType {
  const validFilters: TimelineFilterType[] = ['all', 'tasks', 'agents', 'gates', 'questions'];
  if (param && validFilters.includes(param as TimelineFilterType)) {
    return param as TimelineFilterType;
  }
  return 'all';
}

export function TimelinePage() {
  const { runId } = useParams<{ runId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get filter from URL params
  const filter = parseFilterParam(searchParams.get('filter'));

  // Fetch run data to get timing and status info
  const { run, isLoading: isRunLoading, error: runError } = useRun(runId);

  // Determine if run is currently running
  const isRunning = run?.status === RunStatus.RUNNING;

  // Fetch timeline data with SSE subscription for running runs
  const {
    events,
    filteredEvents,
    counts,
    isLoading: isTimelineLoading,
    error: timelineError,
    refetch,
  } = useTimeline(runId, { filter, isRunning });

  // Handle filter change - persist to URL params
  const handleFilterChange = (newFilter: TimelineFilterType) => {
    if (newFilter === 'all') {
      // Remove filter param when set to 'all'
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', newFilter);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Combined loading state
  const isLoading = isRunLoading || isTimelineLoading;
  const error = runError || timelineError;

  // Loading state
  if (isLoading && !run) {
    return (
      <div className="flex flex-1 flex-col">
        <TimelineHeader runId={runId} planGoal={undefined} />
        <div className="flex flex-1 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col">
        <TimelineHeader runId={runId} planGoal={undefined} />
        <div className="flex flex-1 items-center justify-center">
          <ErrorMessage
            title="Failed to load timeline"
            message={error.message}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  // Empty state (no events)
  if (!isLoading && events.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <TimelineHeader runId={runId} planGoal={run?.plan_goal} />
        <TimelineToolbar
          runId={runId!}
          events={events}
          filter={filter}
          counts={getDefaultEventCounts()}
          onFilterChange={handleFilterChange}
        />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<TimelineIcon size="lg" />}
            title="No events yet"
            description={isRunning ? "Events will appear here as the run progresses." : "This run has no recorded events."}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header with breadcrumb */}
      <TimelineHeader runId={runId} planGoal={run?.plan_goal} />

      {/* Toolbar with filter and export */}
      <TimelineToolbar
        runId={runId!}
        events={events}
        filter={filter}
        counts={counts}
        onFilterChange={handleFilterChange}
      />

      {/* Timeline content */}
      <div className="flex-1 overflow-hidden">
        <TimelineList
          events={filteredEvents}
          runStartTime={run?.started_at}
          runEndTime={run?.completed_at}
          isRunning={isRunning}
          className="h-full"
        />
      </div>
    </div>
  );
}

/**
 * Timeline page header with breadcrumb navigation
 */
interface TimelineHeaderProps {
  runId?: string;
  planGoal?: string;
}

function TimelineHeader({ runId, planGoal }: TimelineHeaderProps) {
  return (
    <div className="border-b border-border-subtle px-6 py-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-2">
        <Link
          to="/forge"
          className="hover:text-text-secondary transition-colors"
        >
          Runs
        </Link>
        <ChevronRightIcon />
        <Link
          to={`/forge/runs/${runId}`}
          className="hover:text-text-secondary transition-colors"
        >
          {runId ? runId.slice(0, 8) : '...'}
        </Link>
        <ChevronRightIcon />
        <span className="text-text-primary">Timeline</span>
      </nav>

      {/* Title */}
      <h1 className="text-2xl font-display font-semibold text-text-primary">
        Timeline
      </h1>

      {/* Plan goal subtitle */}
      {planGoal && (
        <p className="text-sm text-text-secondary mt-1 line-clamp-1">
          {planGoal}
        </p>
      )}
    </div>
  );
}

/**
 * Timeline toolbar with filter tabs and export button
 */
interface TimelineToolbarProps {
  runId: string;
  events: import('@/types').TimelineEvent[];
  filter: TimelineFilterType;
  counts: import('@/types').TimelineEventCounts;
  onFilterChange: (filter: TimelineFilterType) => void;
}

function TimelineToolbar({
  runId,
  events,
  filter,
  counts,
  onFilterChange,
}: TimelineToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border-subtle bg-bg-secondary">
      {/* Filter tabs */}
      <TimelineFilter
        activeFilter={filter}
        counts={counts}
        onChange={onFilterChange}
      />

      {/* Export button */}
      <TimelineExportButton runId={runId} events={events} />
    </div>
  );
}

/**
 * Chevron right icon for breadcrumb separator
 */
function ChevronRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
