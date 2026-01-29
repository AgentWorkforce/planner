import { useRef, useState } from 'react';
import type { Step } from '@/types';
import { useTopologicalSort } from '@/hooks/useTopologicalSort';
import { ScopeSummaryStats } from './ScopeSummaryStats';

interface SwimlaneViewProps {
  steps: Step[];
  onStepClick: (step: Step) => void;
  selectedStepId?: string;
  hoveredStepId?: string;
  onStepHover?: (stepId: string | null) => void;
}

interface SwimlaneStepCardProps {
  step: Step;
  onClick: () => void;
  isSelected: boolean;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SwimlaneStepCard({
  step,
  onClick,
  isSelected,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: SwimlaneStepCardProps) {
  const status = (step as Step & { execution_status?: string }).execution_status || 'pending';

  const statusColors: Record<string, { bg: string; border: string }> = {
    done: { bg: '#dcfce7', border: '#22c55e' },
    completed: { bg: '#dcfce7', border: '#22c55e' },
    running: { bg: '#dbeafe', border: '#3b82f6' },
    in_progress: { bg: '#dbeafe', border: '#3b82f6' },
    blocked: { bg: '#fef3c7', border: '#f59e0b' },
    failed: { bg: '#fee2e2', border: '#ef4444' },
    pending: { bg: 'var(--color-background)', border: 'var(--color-border)' },
  };

  const { bg, border } = statusColors[status] || statusColors.pending;

  return (
    <div
      className={`swimlane-step-card${isSelected ? ' swimlane-step-card--selected' : ''}${isHighlighted ? ' swimlane-step-card--highlighted' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: '180px',
        minHeight: '80px',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        border: `1px solid ${isSelected || isHighlighted ? 'var(--color-primary)' : border}`,
        borderRadius: 'var(--radius-md)',
        backgroundColor: isSelected ? 'var(--color-surface)' : bg,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: isHighlighted ? '0 0 0 2px var(--color-primary)' : 'none',
      }}
    >
      <div
        className="swimlane-step-title"
        style={{
          fontWeight: 500,
          fontSize: '0.875rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.3,
        }}
      >
        {step.title}
      </div>
      <div
        className="swimlane-step-status"
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          marginTop: 'auto',
        }}
      >
        {status.replace('_', ' ')}
      </div>
    </div>
  );
}

interface SwimlaneLaneProps {
  scope: string;
  steps: Step[];
  columnMap: Map<string, number>;
  onStepClick: (step: Step) => void;
  selectedStepId?: string;
  hoveredStepId?: string;
  onStepHover: (stepId: string | null) => void;
}

function SwimlaneLane({
  scope,
  steps,
  columnMap,
  onStepClick,
  selectedStepId,
  hoveredStepId,
  onStepHover,
}: SwimlaneLaneProps) {
  // Sort steps by their column (topological order)
  const sortedSteps = [...steps].sort((a, b) => {
    const colA = columnMap.get(a.step_id) ?? 0;
    const colB = columnMap.get(b.step_id) ?? 0;
    return colA - colB;
  });

  return (
    <div
      className="swimlane-lane"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--color-border)',
        minHeight: '120px',
        padding: 'var(--spacing-md) 0',
      }}
    >
      {/* Fixed left label */}
      <div
        className="swimlane-lane-label"
        style={{
          width: '160px',
          flexShrink: 0,
          position: 'sticky',
          left: 0,
          backgroundColor: 'var(--color-background)',
          zIndex: 5,
          padding: 'var(--spacing-md)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          {scope || 'General'}
        </div>
        <ScopeSummaryStats steps={steps} compact />
      </div>

      {/* Steps area */}
      <div
        className="swimlane-steps-area"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          minWidth: 'fit-content',
        }}
      >
        {sortedSteps.map((step) => (
          <SwimlaneStepCard
            key={step.step_id}
            step={step}
            onClick={() => onStepClick(step)}
            isSelected={selectedStepId === step.step_id}
            isHighlighted={hoveredStepId === step.step_id}
            onMouseEnter={() => onStepHover(step.step_id)}
            onMouseLeave={() => onStepHover(null)}
          />
        ))}
        {sortedSteps.length === 0 && (
          <div
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.875rem',
              fontStyle: 'italic',
            }}
          >
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
      className="swimlane-container"
      style={{
        overflowX: 'auto',
        overflowY: 'visible',
        position: 'relative',
        minHeight: '400px',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {sortedScopes.map((scope) => (
        <SwimlaneLane
          key={scope || '__general__'}
          scope={scope}
          steps={scopeGroups.get(scope)!}
          columnMap={columnMap}
          onStepClick={onStepClick}
          selectedStepId={selectedStepId}
          hoveredStepId={effectiveHoveredId ?? undefined}
          onStepHover={handleStepHover}
        />
      ))}
      {sortedScopes.length === 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            color: 'var(--color-text-muted)',
          }}
        >
          No steps to display
        </div>
      )}
    </div>
  );
}
