/**
 * RunsListPage - List of all orchestration runs
 *
 * Features:
 * - Status filtering with count badges
 * - Responsive grid of RunCards
 * - Real-time updates for running runs
 * - Import Plan modal
 * - Pagination
 * - Loading, error, and empty states
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RunsIcon } from '@/components/icons';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/Button';
import { RunCard } from '@/components/RunCard';
import { RunCardSkeleton } from '@/components/RunCardSkeleton';
import {
  StatusFilterTabs,
  type StatusFilter,
  getDefaultStatusCounts,
} from '@/components/StatusFilterTabs';
import { Pagination } from '@/components/Pagination';
import { ImportPlanModal } from '@/components/ImportPlanModal';
import { useRuns, useRunsCounts } from '@/hooks/useRuns';
import { useRunningUpdates } from '@/hooks/useRunningUpdates';
import { RunStatus, type RunSummary } from '@/types';

const PAGE_SIZE = 12;

export function RunsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL params
  const statusParam = searchParams.get('status') as StatusFilter | null;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // State
  const [activeFilter, setActiveFilter] = useState<StatusFilter>(
    statusParam || 'all'
  );
  const [currentPage, setCurrentPage] = useState(pageParam);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Calculate offset for pagination
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Fetch runs with current filter and pagination
  const { runs, total, isLoading, error, refetch } = useRuns({
    status: activeFilter === 'all' ? undefined : (activeFilter as RunStatus),
    limit: PAGE_SIZE,
    offset,
  });

  // Fetch counts for filter tabs
  const { counts } = useRunsCounts();

  // Get IDs of running runs for real-time updates
  const runningRunIds = useMemo(
    () =>
      runs
        .filter((run) => run.status === RunStatus.RUNNING)
        .map((run) => run.run_id),
    [runs]
  );

  // Subscribe to real-time updates for running runs
  const { getUpdate } = useRunningUpdates(runningRunIds);

  // Merge real-time updates with runs data
  const mergedRuns = useMemo((): RunSummary[] => {
    return runs.map((run) => {
      const update = getUpdate(run.run_id);
      if (update) {
        return {
          ...run,
          completed_tasks: update.completed_tasks,
          status: update.status,
        };
      }
      return run;
    });
  }, [runs, getUpdate]);

  // Handle filter change
  const handleFilterChange = useCallback(
    (filter: StatusFilter) => {
      setActiveFilter(filter);
      setCurrentPage(1);

      const params = new URLSearchParams(searchParams);
      if (filter === 'all') {
        params.delete('status');
      } else {
        params.set('status', filter);
      }
      params.delete('page'); // Reset to page 1
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  // Handle page change
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);

      const params = new URLSearchParams(searchParams);
      if (page === 1) {
        params.delete('page');
      } else {
        params.set('page', page.toString());
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  // Sync state with URL params on mount
  useEffect(() => {
    if (statusParam && statusParam !== activeFilter) {
      setActiveFilter(statusParam);
    }
    if (pageParam !== currentPage) {
      setCurrentPage(pageParam);
    }
  }, []); // Only on mount

  // Build counts object for filter tabs
  const statusCounts = useMemo(
    () => ({
      ...getDefaultStatusCounts(),
      ...counts,
    }),
    [counts]
  );

  // Render skeleton loading state
  const renderSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <RunCardSkeleton key={i} />
      ))}
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="flex flex-1 items-center justify-center">
      <ErrorMessage
        title="Failed to load runs"
        message={error?.message || 'An unexpected error occurred'}
        onRetry={refetch}
      />
    </div>
  );

  // Render empty state
  const renderEmpty = () => {
    const isFiltered = activeFilter !== 'all';

    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<RunsIcon size="lg" />}
          title={isFiltered ? 'No matching runs' : 'No runs yet'}
          description={
            isFiltered
              ? `No runs with status "${activeFilter}" found.`
              : 'Runs will appear here when plans are published and executed by the orchestrator.'
          }
          action={
            isFiltered ? (
              <Button variant="outline" onClick={() => handleFilterChange('all')}>
                Clear filter
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setImportModalOpen(true)}>
                Import Plan
              </Button>
            )
          }
        />
      </div>
    );
  };

  // Render runs grid
  const renderRuns = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mergedRuns.map((run) => (
          <RunCard key={run.run_id} run={run} />
        ))}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Pagination
          currentPage={currentPage}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          className="mt-6 border-t border-border-subtle"
        />
      )}
    </>
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">
              Runs
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Monitor and manage orchestration runs
            </p>
          </div>
          <Button variant="primary" onClick={() => setImportModalOpen(true)}>
            <PlusIcon />
            Import Plan
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-6 py-4 border-b border-border-subtle">
        <StatusFilterTabs
          activeFilter={activeFilter}
          counts={statusCounts}
          onChange={handleFilterChange}
        />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 overflow-auto">
        {isLoading
          ? renderSkeletons()
          : error
            ? renderError()
            : runs.length === 0
              ? renderEmpty()
              : renderRuns()}
      </div>

      {/* Import Plan Modal */}
      <ImportPlanModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
      />
    </div>
  );
}

/**
 * Plus icon for Import button.
 */
function PlusIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
