import { useRef, useState, useMemo } from 'react';
import type { Step } from '@/types';
import { useTopologicalSort } from '@/hooks/useTopologicalSort';
import { ScopeSummaryStats } from './ScopeSummaryStats';
import { DependencyIndicator, type ConnectedStep, type DependencyDirection } from './DependencyIndicator';

interface SwimlaneViewProps {
  steps: Step[];
  onStepClick: (step: Step) => void;
  selectedStepId?: string;
  hoveredStepId?: string;
  onStepHover?: (stepId: string | null) => void;
  onIndicatorHover?: (direction: DependencyDirection | null) => void;
  onScrollToStep?: (stepId: string) => void;
}

interface SwimlaneStepCardProps {
  step: Step;
  allSteps: Step[];
  onClick: () => void;
  isSelected: boolean;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onIndicatorHover?: (direction: DependencyDirection | null) => void;
  onScrollToStep?: (stepId: string) => void;
}

function SwimlaneStepCard({
  step,
  allSteps,
  onClick,
  isSelected,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
  onIndicatorHover,
  onScrollToStep,
}: SwimlaneStepCardProps) {
  const status = (step as Step & { execution_status?: string }).execution_status || 'pending';

  // Compute dependency info for indicators
  const { incomingSteps, outgoingSteps, hasCrossScopeIncoming, hasCrossScopeOutgoing } = useMemo(() => {
    const incoming: ConnectedStep[] = [];
    const outgoing: ConnectedStep[] = [];
    let crossScopeIn = false;
    let crossScopeOut = false;

    const stepScope = step.scope || '';

    // Incoming: steps this step depends on
    for (const depId of step.dependencies || []) {
      const depStep = allSteps.find((s) => s.step_id === depId);
      if (depStep) {
        incoming.push({
          stepId: depStep.step_id,
          title: depStep.title,
          scope: depStep.scope,
        });
        if ((depStep.scope || '') !== stepScope) {
          crossScopeIn = true;
        }
      }
    }

    // Outgoing: steps that depend on this step
    for (const s of allSteps) {
      if (s.dependencies?.includes(step.step_id)) {
        outgoing.push({
          stepId: s.step_id,
          title: s.title,
          scope: s.scope,
        });
        if ((s.scope || '') !== stepScope) {
          crossScopeOut = true;
        }
      }
    }

    return {
      incomingSteps: incoming,
      outgoingSteps: outgoing,
      hasCrossScopeIncoming: crossScopeIn,
      hasCrossScopeOutgoing: crossScopeOut,
    };
  }, [step, allSteps]);

  const statusClasses: Record<string, string> = {
    done: 'bg-success/10 border-success',
    completed: 'bg-success/10 border-success',
    running: 'bg-accent-cyan/10 border-accent-cyan',
    in_progress: 'bg-accent-cyan/10 border-accent-cyan',
    blocked: 'bg-warning/10 border-warning',
    failed: 'bg-error/10 border-error',
    pending: 'bg-bg-card border-border-subtle',
  };

  const baseClasses = statusClasses[status] || statusClasses.pending;

  return (
    <div
      className={`relative w-44 min-h-20 p-3 border rounded-lg cursor-pointer flex flex-col gap-1 transition-all duration-200 ${baseClasses} ${
        isSelected || isHighlighted
          ? 'border-accent-cyan ring-2 ring-accent-cyan/50'
          : ''
      } ${isSelected ? 'bg-bg-elevated' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Dependency Indicators */}
      <DependencyIndicator
        direction="incoming"
        count={incomingSteps.length}
        hasCrossScope={hasCrossScopeIncoming}
        connectedSteps={incomingSteps}
        onHover={(hovered) => onIndicatorHover?.(hovered ? 'incoming' : null)}
        onClick={() => incomingSteps[0] && onScrollToStep?.(incomingSteps[0].stepId)}
        isParentHovered={isHighlighted}
      />
      <DependencyIndicator
        direction="outgoing"
        count={outgoingSteps.length}
        hasCrossScope={hasCrossScopeOutgoing}
        connectedSteps={outgoingSteps}
        onHover={(hovered) => onIndicatorHover?.(hovered ? 'outgoing' : null)}
        onClick={() => outgoingSteps[0] && onScrollToStep?.(outgoingSteps[0].stepId)}
        isParentHovered={isHighlighted}
      />

      <div className="text-sm font-medium text-text-primary line-clamp-2 leading-tight">
        {step.title}
      </div>
      <div className="text-xs text-text-muted mt-auto capitalize">
        {status.replace('_', ' ')}
      </div>
    </div>
  );
}

interface SwimlaneLaneProps {
  scope: string;
  steps: Step[];
  allSteps: Step[];
  columnMap: Map<string, number>;
  onStepClick: (step: Step) => void;
  selectedStepId?: string;
  hoveredStepId?: string;
  onStepHover: (stepId: string | null) => void;
  onIndicatorHover?: (direction: DependencyDirection | null) => void;
  onScrollToStep?: (stepId: string) => void;
}

function SwimlaneLane({
  scope,
  steps,
  allSteps,
  columnMap,
  onStepClick,
  selectedStepId,
  hoveredStepId,
  onStepHover,
  onIndicatorHover,
  onScrollToStep,
}: SwimlaneLaneProps) {
  // Sort steps by their column (topological order)
  const sortedSteps = [...steps].sort((a, b) => {
    const colA = columnMap.get(a.step_id) ?? 0;
    const colB = columnMap.get(b.step_id) ?? 0;
    return colA - colB;
  });

  return (
    <div className="flex items-start border-b border-border-subtle min-h-32 py-4">
      {/* Fixed left label */}
      <div className="w-40 flex-shrink-0 sticky left-0 bg-bg-primary z-10 p-4 border-r border-border-subtle">
        <div className="text-sm font-semibold text-text-primary mb-1">
          {scope || 'General'}
        </div>
        <ScopeSummaryStats steps={steps} compact />
      </div>

      {/* Steps area */}
      <div className="flex items-center gap-4 p-4 min-w-fit">
        {sortedSteps.map((step) => (
          <SwimlaneStepCard
            key={step.step_id}
            step={step}
            allSteps={allSteps}
            onClick={() => onStepClick(step)}
            isSelected={selectedStepId === step.step_id}
            isHighlighted={hoveredStepId === step.step_id}
            onMouseEnter={() => onStepHover(step.step_id)}
            onMouseLeave={() => onStepHover(null)}
            onIndicatorHover={onIndicatorHover}
            onScrollToStep={onScrollToStep}
          />
        ))}
        {sortedSteps.length === 0 && (
          <div className="text-sm text-text-muted italic">
            No steps in this scope
          </div>
        )}
      </div>
    </div>
  );
}

export function SwimlaneView({
  steps,
  onStepClick,
  selectedStepId,
  hoveredStepId,
  onStepHover,
  onIndicatorHover,
  onScrollToStep,
}: SwimlaneViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnMap = useTopologicalSort(steps);
  const [localHoveredId, setLocalHoveredId] = useState<string | null>(null);

  const effectiveHoveredId = hoveredStepId ?? localHoveredId;

  const handleStepHover = (stepId: string | null) => {
    setLocalHoveredId(stepId);
    onStepHover?.(stepId);
  };

  // Group steps by scope
  const scopeGroups = new Map<string, Step[]>();
  for (const step of steps) {
    const scope = step.scope || '';
    if (!scopeGroups.has(scope)) {
      scopeGroups.set(scope, []);
    }
    scopeGroups.get(scope)!.push(step);
  }

  // Sort scopes alphabetically, but put empty scope (General) last
  const sortedScopes = Array.from(scopeGroups.keys()).sort((a, b) => {
    if (a === '' && b !== '') return 1;
    if (b === '' && a !== '') return -1;
    return a.localeCompare(b);
  });

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto overflow-y-visible relative min-h-96 border border-border-subtle rounded-xl bg-bg-primary"
    >
      {sortedScopes.map((scope) => (
        <SwimlaneLane
          key={scope || '__general__'}
          scope={scope}
          steps={scopeGroups.get(scope)!}
          allSteps={steps}
          columnMap={columnMap}
          onStepClick={onStepClick}
          selectedStepId={selectedStepId}
          hoveredStepId={effectiveHoveredId ?? undefined}
          onStepHover={handleStepHover}
          onIndicatorHover={onIndicatorHover}
          onScrollToStep={onScrollToStep}
        />
      ))}
      {sortedScopes.length === 0 && (
        <div className="flex items-center justify-center min-h-48 text-text-muted">
          No steps to display
        </div>
      )}
    </div>
  );
}
