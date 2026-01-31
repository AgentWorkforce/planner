import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PipelineToolbar, type ViewMode } from '@/components/pipeline/PipelineToolbar';
import { SequenceView } from '@/components/pipeline/SequenceView';
import { BoardView } from '@/components/pipeline/BoardView';
import { PipelineEmptyState } from '@/components/pipeline/PipelineEmptyState';
import { usePipelinePlans } from '@/hooks/usePipelinePlans';

/**
 * PipelinePage - Main pipeline view page.
 *
 * Visualizes plan execution flow based on dependencies and workflow state.
 * Two view modes:
 * - Sequence: Plans organized by dependency waves (NOW, Wave 2, Wave 3, DONE)
 * - Board: Plans organized by workflow status (Drafting, Gate, Approved, Running, Complete)
 *
 * Features:
 * - Initiative filtering (tabs for All + each initiative)
 * - View mode toggle (Sequence | Board)
 * - Empty state when no plans exist
 * - Click plan card to navigate to editor
 * - Create new plan from toolbar
 *
 * Design spec: docs/flow/features/ui-pipeline-view.json step p013
 *
 * @example
 * ```tsx
 * // In router configuration:
 * <Route path="/pipeline" element={<PipelinePage />} />
 * ```
 */
export function PipelinePage() {
  const navigate = useNavigate();
  const [selectedInitiative, setSelectedInitiative] = useState<string | null>(null);

  // Read view mode from localStorage on mount
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('pipeline-view-mode');
    return (stored === 'board' || stored === 'sequence') ? stored : 'sequence';
  });

  const { plans, waveGroups, statusGroups, isLoading, error } = usePipelinePlans(selectedInitiative);

  const handleNewPlan = () => navigate('/plans/new');
  const handlePlanClick = (planId: string) => navigate(`/plans/${planId}`);

  // Persist view mode changes to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('pipeline-view-mode', mode);
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <p className="text-lg text-text-primary mb-2">Error loading pipeline</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PipelineToolbar
        selectedInitiative={selectedInitiative}
        onSelectInitiative={setSelectedInitiative}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onNewPlan={handleNewPlan}
      />

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <LoadingSkeleton viewMode={viewMode} />
        ) : plans.length === 0 ? (
          <PipelineEmptyState
            initiativeId={selectedInitiative || undefined}
            onCreatePlan={handleNewPlan}
          />
        ) : viewMode === 'sequence' ? (
          <SequenceView waveGroups={waveGroups} onPlanClick={handlePlanClick} />
        ) : (
          <BoardView statusGroups={statusGroups} onPlanClick={handlePlanClick} />
        )}
      </div>
    </div>
  );
}

/**
 * LoadingSkeleton - Placeholder UI while plans are loading.
 *
 * Shows different skeleton layout based on view mode:
 * - Sequence: Horizontal columns skeleton
 * - Board: Kanban columns skeleton
 */
function LoadingSkeleton({ viewMode }: { viewMode: ViewMode }) {
  const columnCount = viewMode === 'sequence' ? 4 : 5;

  return (
    <div className="flex h-full overflow-x-auto gap-3 p-3">
      {Array.from({ length: columnCount }).map((_, i) => (
        <div
          key={i}
          className="min-w-[280px] flex-shrink-0 bg-bg-secondary rounded-xl border border-border-subtle p-3"
        >
          <div className="h-6 w-24 bg-bg-tertiary rounded mb-3 animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="h-24 bg-bg-tertiary rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
