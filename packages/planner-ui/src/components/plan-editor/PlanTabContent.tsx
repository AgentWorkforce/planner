import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePlanEditor } from '@/contexts/PlanEditorContext';
import type { ParentPlanInfo, Step } from '@/types';
import type { ResolvedSubPlanEntry } from '@/api';
import { updatePlan } from '@/api';
import { StepEditor } from '@/components/StepEditor';
import { SwimlaneView } from '@/components/SwimlaneView';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DependencyLinesOverlay } from '@/components/DependencyLinesOverlay';
import { Badge } from '@/components/ui/Badge';

/** Renders an inline sub-plan section with fully interactive steps. */
function SubPlanSection({ entry }: { entry: ResolvedSubPlanEntry }) {
  const { sub_plan } = entry;
  const [steps, setSteps] = useState(sub_plan.steps);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [hoveredDirection, setHoveredDirection] = useState<'incoming' | 'outgoing' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const statusVariant = sub_plan.status === 'approved' ? 'approved'
    : sub_plan.status === 'published' ? 'published'
    : 'draft';
  const isEditable = sub_plan.status === 'draft' || sub_plan.status === null;

  const handleUpdate = useCallback(async (stepId: string, updates: Partial<Step>) => {
    const updatedSteps = steps.map((s) =>
      s.step_id === stepId ? { ...s, ...updates } : s
    );
    const result = await updatePlan(sub_plan.plan_id, { steps: updatedSteps });
    setSteps(result.version.steps);
  }, [sub_plan.plan_id, steps]);

  const handleDelete = useCallback(async (stepId: string) => {
    const updatedSteps = steps.filter((s) => s.step_id !== stepId);
    const cleanedSteps = updatedSteps.map((s) => ({
      ...s,
      dependencies: s.dependencies.filter((depId) => depId !== stepId),
    }));
    const result = await updatePlan(sub_plan.plan_id, { steps: cleanedSteps });
    setSteps(result.version.steps);
  }, [sub_plan.plan_id, steps]);

  const handleScrollToStep = useCallback((stepId: string) => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-step-id="${stepId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div className="border border-border-subtle rounded-lg bg-bg-card/50">
      {/* Sub-plan section header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-tertiary/50 border-b border-border-subtle">
        <Link
          to={`/plans/${sub_plan.plan_id}`}
          className="font-medium text-text-primary hover:text-accent-cyan transition-colors"
        >
          {sub_plan.goal}
        </Link>
        <Badge variant={statusVariant}>{sub_plan.status ?? 'draft'}</Badge>
        <span className="text-xs text-text-muted">
          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </span>
      </div>
      {/* Sub-plan steps — expandable, editable if draft, with dependency lines */}
      <div ref={containerRef} className="relative space-y-1 p-2 pl-10 pr-10">
        {steps.map((step) => {
          const isExpanded = expandedStepId === step.step_id;
          return (
            <div
              key={step.step_id}
              data-step-id={step.step_id}
              onMouseEnter={() => setHoveredStepId(step.step_id)}
              onMouseLeave={() => setHoveredStepId(null)}
            >
              <StepEditor
                step={step}
                allSteps={steps}
                planId={sub_plan.plan_id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                disabled={!isEditable}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedStepId(isExpanded ? null : step.step_id)}
                onIndicatorHover={setHoveredDirection}
                onScrollToStep={handleScrollToStep}
                isHovered={hoveredStepId === step.step_id}
              />
            </div>
          );
        })}
        <DependencyLinesOverlay
          steps={steps}
          containerRef={containerRef}
          hoveredStepId={hoveredStepId}
          hoveredDirection={hoveredDirection}
          viewMode="list"
        />
      </div>
    </div>
  );
}

/** Counts total steps across all resolved entries. */
function countResolvedSteps(resolvedSteps: ResolvedSubPlanEntry[] | ReturnType<typeof usePlanEditor>['resolvedSteps']): number {
  let count = 0;
  for (const entry of resolvedSteps) {
    if (entry.type === 'step') {
      count += 1;
    } else {
      count += entry.sub_plan.steps.length;
    }
  }
  return count;
}

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
    isCoordinationPlan,
    resolvedSteps,
    handleStepUpdate,
    handleStepDelete,
    openCommentsPanel,
    getUnresolvedCount,
  } = usePlanEditor();

  if (!plan || !version) return null;

  const totalStepCount = isCoordinationPlan && resolvedSteps.length > 0
    ? countResolvedSteps(resolvedSteps)
    : version.steps.length;

  return (
    <div className="px-6 py-6 space-y-6 overflow-hidden">
      {/* Steps header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Steps ({totalStepCount})
        </h2>
        {version.steps.length > 0 && !isCoordinationPlan && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </div>

      {version.steps.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No steps yet. Add steps to define the work needed to achieve your goal.
        </div>
      ) : isCoordinationPlan && resolvedSteps.length > 0 ? (
        /* Flattened coordination plan view */
        <div ref={stepsContainerRef} className="relative pl-10 pr-10">
          <div className="space-y-2">
            {resolvedSteps.map((entry) => {
              if (entry.type === 'sub_plan') {
                return (
                  <SubPlanSection
                    key={`sub-${entry.sub_plan.plan_id}`}
                    entry={entry}
                  />
                );
              }

              // Regular step (same as non-coordination rendering)
              const step = entry.step;
              const isExpanded = expandedStepId === step.step_id;
              const isSelected = selectedStep?.step_id === step.step_id;
              const isEditable = version.status === 'draft';
              const unresolvedComments = getUnresolvedCount(step.step_id);

              return (
                <div
                  key={step.step_id}
                  data-step-id={step.step_id}
                  className={`rounded-lg transition-colors ${
                    isSelected ? 'ring-1 ring-accent-cyan' : ''
                  }`}
                  onClick={(e) => {
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
        </div>
      ) : (
        /* Standard plan view (non-coordination) */
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

                // Sub-plan steps render as links (fallback if resolved data not loaded yet)
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
