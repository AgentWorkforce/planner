import { Link } from 'react-router-dom';
import { usePlanEditor } from '@/contexts/PlanEditorContext';
import type { ParentPlanInfo } from '@/types';
import { StepEditor } from '@/components/StepEditor';
import { SwimlaneView } from '@/components/SwimlaneView';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DependencyLinesOverlay } from '@/components/DependencyLinesOverlay';
import { Badge } from '@/components/ui/Badge';

export function PlanTabContent() {
  const {
    plan,
    version,
    parents,
    selectedStep,
    setSelectedStep,
    expandedStepId,
    setExpandedStepId,
    viewMode,
    setViewMode,
    hoveredStepId,
    setHoveredStepId,
    hoveredDirection,
    setHoveredDirection,
    stepsContainerRef,
    handleScrollToStep,
    handleStepUpdate,
    handleStepDelete,
    openCommentsPanel,
    getUnresolvedCount,
  } = usePlanEditor();

  if (!plan || !version) return null;

  return (
    <div className="px-6 py-6 space-y-6 overflow-hidden">
      {/* Steps header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Steps ({version.steps.length})
        </h2>
        {version.steps.length > 0 && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </div>

      {version.steps.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No steps yet. Add steps to define the work needed to achieve your goal.
        </div>
      ) : (
        <div ref={stepsContainerRef} className="relative pl-10 pr-10">
          {/* Left/right 40px gutters for dependency lines */}
          {viewMode === 'list' ? (
            <div className="space-y-2">
              {version.steps.map((step) => {
                const hasSubPlan = !!step.sub_plan_id;
                const isExpanded = expandedStepId === step.step_id;
                const isSelected = selectedStep?.step_id === step.step_id;
                const isEditable = version.status === 'draft';
                const unresolvedComments = getUnresolvedCount(step.step_id);

                // Sub-plan steps render as links
                if (hasSubPlan) {
                  const newParents: ParentPlanInfo[] = [
                    ...parents,
                    { plan_id: plan.plan_id, goal: version.summary.goal },
                  ];

                  return (
                    <div
                      key={step.step_id}
                      data-step-id={step.step_id}
                      className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden hover:border-border-light transition-colors"
                    >
                      <Link
                        to={`/plans/${step.sub_plan_id}`}
                        className="block p-4"
                        state={{ parents: newParents }}
                        aria-label={`Navigate to sub-plan: ${step.title}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-text-primary">{step.title}</span>
                          {step.scope && (
                            <span className="text-xs px-2 py-0.5 bg-bg-tertiary text-text-muted rounded">
                              {step.scope}
                            </span>
                          )}
                          <Badge variant="info">Sub-plan</Badge>
                        </div>
                      </Link>
                    </div>
                  );
                }

                // Regular steps use StepEditor
                return (
                  <div
                    key={step.step_id}
                    data-step-id={step.step_id}
                    className={`rounded-lg transition-colors ${
                      isSelected ? 'ring-1 ring-accent-cyan' : ''
                    }`}
                    onClick={(e) => {
                      // Don't toggle selection if clicking interactive elements (buttons, inputs, etc.)
                      const target = e.target as HTMLElement;
                      const isInteractive = target.closest('button, input, select, textarea, a, [role="button"]');
                      if (!isInteractive) {
                        setSelectedStep(isSelected ? undefined : step);
                      }
                    }}
                    onMouseEnter={() => setHoveredStepId(step.step_id)}
                    onMouseLeave={() => setHoveredStepId(null)}
                  >
                    <StepEditor
                      step={step}
                      allSteps={version.steps}
                      planId={plan.plan_id}
                      onUpdate={handleStepUpdate}
                      onDelete={handleStepDelete}
                      disabled={!isEditable}
                      isExpanded={isExpanded}
                      onToggleExpand={() =>
                        setExpandedStepId(isExpanded ? null : step.step_id)
                      }
                      commentCount={unresolvedComments}
                      onOpenComments={openCommentsPanel}
                      onIndicatorHover={setHoveredDirection}
                      onScrollToStep={handleScrollToStep}
                      isHovered={hoveredStepId === step.step_id}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <SwimlaneView
              steps={version.steps}
              onStepClick={(step) => setSelectedStep(step)}
              selectedStepId={selectedStep?.step_id}
              hoveredStepId={hoveredStepId ?? undefined}
              onStepHover={setHoveredStepId}
              onIndicatorHover={setHoveredDirection}
              onScrollToStep={handleScrollToStep}
            />
          )}
          {/* Dependency lines only for list view - swimlane has its own cross-scope lines */}
          {viewMode === 'list' && (
            <DependencyLinesOverlay
              steps={version.steps}
              containerRef={stepsContainerRef}
              hoveredStepId={hoveredStepId}
              hoveredDirection={hoveredDirection}
              viewMode={viewMode}
            />
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center gap-6 text-sm text-text-muted">
        <span>Created: {new Date(version.created_at).toLocaleString()}</span>
        <span>Updated: {new Date(version.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
