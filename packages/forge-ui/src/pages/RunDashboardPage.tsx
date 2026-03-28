/**
 * RunDashboardPage - Dashboard view for a single orchestration run
 *
 * Features:
 * - Real-time run status and progress
 * - Task list with grouping by scope
 * - Gate approval banner
 * - Run controls (pause/resume/cancel)
 * - Agent activity sidebar with ActiveAgentsSection
 * - Responsive two-column layout
 */

import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useRun } from '@/hooks/useRun';
import { useArtifacts } from '@/hooks/useArtifacts';
import { RunHeader, RunHeaderSkeleton } from '@/components/RunHeader';
import { GateBannerSimple } from '@/components/GateBanner';
import { TaskList } from '@/components/TaskList';
import { ActiveAgentsSection } from '@/components/ActiveAgentsSection';
import { ArtifactsPanel, ArtifactsPanelHighlighted } from '@/components/ArtifactsPanel';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { pauseRun, resumeRun, cancelRun } from '@/api/runs';
import { RunStatus, type Gate } from '@/types';

export function RunDashboardPage() {
  const { runId } = useParams<{ runId: string }>();
  const { run, tasks, activeGate, elapsedMs, isLoading, error, refetch } = useRun(runId);
  const {
    artifacts,
    isLoading: artifactsLoading,
    refetch: refetchArtifacts,
    refreshPR,
    refreshingArtifacts,
  } = useArtifacts(runId);

  // Handler for pausing the run
  const handlePause = useCallback(async () => {
    if (!runId) return;
    try {
      await pauseRun(runId);
      await refetch();
    } catch (err) {
      // TODO: Show error toast
      console.error('Failed to pause run:', err);
    }
  }, [runId, refetch]);

  // Handler for resuming the run
  const handleResume = useCallback(async () => {
    if (!runId) return;
    try {
      await resumeRun(runId);
      await refetch();
    } catch (err) {
      // TODO: Show error toast
      console.error('Failed to resume run:', err);
    }
  }, [runId, refetch]);

  // Handler for cancelling the run
  const handleCancel = useCallback(async () => {
    if (!runId) return;
    try {
      await cancelRun(runId);
      await refetch();
    } catch (err) {
      // TODO: Show error toast
      console.error('Failed to cancel run:', err);
    }
  }, [runId, refetch]);

  // Handler for reviewing a gate
  const handleGateReview = useCallback((gate: Gate) => {
    // TODO: Open gate review panel/modal
    console.log('Review gate:', gate.gate_id);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <RunHeaderSkeleton />
        <div className="flex-1 p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Task list skeleton */}
            <div className="flex-1 lg:w-2/3 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            {/* Sidebar skeleton */}
            <div className="lg:w-1/3 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border-subtle px-6 py-4">
          <h1 className="text-2xl font-display font-semibold text-text-primary">
            Run Dashboard
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <ErrorMessage
            title="Failed to load run"
            message={error.message}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  // Not found state
  if (!run) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border-subtle px-6 py-4">
          <h1 className="text-2xl font-display font-semibold text-text-primary">
            Run Dashboard
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<NotFoundIcon />}
            title="Run not found"
            description={`The run with ID "${runId}" could not be found.`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header with progress and controls */}
      <RunHeader
        run={run}
        elapsedMs={elapsedMs}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
      />

      {/* Gate banner (if pending) */}
      {activeGate && (
        <div className="px-6 pt-4">
          <GateBannerSimple gate={activeGate} onReview={handleGateReview} />
        </div>
      )}

      {/* Highlighted artifacts panel for completed runs */}
      {run.status === RunStatus.COMPLETED && artifacts.length > 0 && (
        <div className="px-6 pt-4">
          <ArtifactsPanelHighlighted
            artifacts={artifacts}
            onRefresh={refetchArtifacts}
            onRefreshPR={refreshPR}
            isLoading={artifactsLoading}
            refreshingArtifacts={refreshingArtifacts}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Task list (main area - 2/3 on desktop) */}
          <div className="flex-1 lg:w-2/3 overflow-auto">
            <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Tasks
              </h2>
              <TaskList tasks={tasks} />
            </div>
          </div>

          {/* Sidebar (1/3 on desktop) */}
          <div className="lg:w-1/3 space-y-4">
            {/* Active agents section with cards and detail panel */}
            <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
              <ActiveAgentsSection runId={runId} />
            </div>

            {/* Artifacts panel (for non-completed runs or when no prominent display) */}
            {run.status !== RunStatus.COMPLETED && (
              <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
                <ArtifactsPanel
                  artifacts={artifacts}
                  onRefresh={refetchArtifacts}
                  onRefreshPR={refreshPR}
                  isLoading={artifactsLoading}
                  refreshingArtifacts={refreshingArtifacts}
                />
              </div>
            )}

            {/* Run metadata */}
            <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                Details
              </h2>
              <RunMetadata run={run} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * RunMetadata - Display run metadata
 */
interface RunMetadataProps {
  run: {
    run_id: string;
    plan_id: string;
    plan_version: number;
    created_at: string;
    started_at?: string;
    triggered_by?: string;
  };
}

function RunMetadata({ run }: RunMetadataProps) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-text-muted">Run ID</dt>
        <dd className="text-text-secondary font-mono text-xs">{run.run_id.slice(0, 8)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-text-muted">Plan ID</dt>
        <dd className="text-text-secondary font-mono text-xs">{run.plan_id.slice(0, 8)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-text-muted">Version</dt>
        <dd className="text-text-secondary">v{run.plan_version}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-text-muted">Created</dt>
        <dd className="text-text-secondary">
          {new Date(run.created_at).toLocaleString()}
        </dd>
      </div>
      {run.started_at && (
        <div className="flex justify-between">
          <dt className="text-text-muted">Started</dt>
          <dd className="text-text-secondary">
            {new Date(run.started_at).toLocaleString()}
          </dd>
        </div>
      )}
      {run.triggered_by && (
        <div className="flex justify-between">
          <dt className="text-text-muted">Triggered by</dt>
          <dd className="text-text-secondary">{run.triggered_by}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Not found icon
 */
function NotFoundIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
