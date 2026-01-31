import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import type { Step } from '@/types';
import { useTopologicalSort } from '@/hooks/useTopologicalSort';
import { ScopeSummaryStats } from './ScopeSummaryStats';
import { DependencyIndicator, type ConnectedStep, type DependencyDirection } from './DependencyIndicator';

interface DependencyLine {
  fromId: string;
  toId: string;
  isHighlighted: boolean;
  isCrossScope: boolean;
}

interface DependencyLinesOverlayProps {
  steps: Step[];
  containerRef: React.RefObject<HTMLElement | null>;
  hoveredStepId?: string | null;
}

// Indicator dot size (Tailwind w-2.5 = 10px, centered on card edge)
const INDICATOR_RADIUS = 5;

/**
 * Generate orthogonal (right-angle) path for dependency lines.
 * Connects from the GREEN outgoing indicator (right side of source)
 * to the BLUE incoming indicator (left side of target).
 */
function generateOrthogonalPath(from: DOMRect, to: DOMRect): string {
  // Connect to the indicator dots:
  // - Start from outer edge of outgoing (green) indicator on right side
  // - End at outer edge of incoming (blue) indicator on left side
  const startX = from.x + from.width + INDICATOR_RADIUS;
  const startY = from.y + from.height / 2;

  const endX = to.x - INDICATOR_RADIUS;
  const endY = to.y + to.height / 2;

  // Midpoint for vertical segment
  const midX = (startX + endX) / 2;

  // Orthogonal path: right → down/up → right
  return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
}

function DependencyLinesOverlay({
  steps,
  containerRef,
  hoveredStepId,
}: DependencyLinesOverlayProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());

  // Use ref to avoid recreating callback when steps array reference changes
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // Compute positions for all step cards
  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newPositions = new Map<string, DOMRect>();

    for (const step of stepsRef.current) {
      const el = container.querySelector(`[data-step-id="${step.step_id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newPositions.set(step.step_id, new DOMRect(
          rect.x - containerRect.x + container.scrollLeft,
          rect.y - containerRect.y + container.scrollTop,
          rect.width,
          rect.height
        ));
      }
    }

    // Only update if we found positions
    if (newPositions.size > 0) {
      setPositions(newPositions);
    }
  }, [containerRef]);

  // Update dimensions and positions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.scrollWidth,
          height: containerRef.current.scrollHeight,
        });
        // Also update positions when dimensions change
        updatePositions();
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [containerRef, updatePositions]);

  // Watch for DOM changes (cards being added) and ensure positions are calculated
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver(() => {
      updatePositions();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    // Multiple attempts to catch when DOM is ready
    const timers = [
      setTimeout(updatePositions, 0),
      setTimeout(updatePositions, 50),
      setTimeout(updatePositions, 150),
      setTimeout(updatePositions, 300),
    ];

    // Also update on next animation frame
    const raf = requestAnimationFrame(updatePositions);

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [containerRef, updatePositions]);

  // Build ALL dependency lines (both same-scope and cross-scope)
  const lines: DependencyLine[] = useMemo(() => {
    const result: DependencyLine[] = [];
    const seen = new Set<string>();

    for (const step of steps) {
      const stepScope = step.scope || '';

      for (const depId of step.dependencies || []) {
        const depStep = steps.find((s) => s.step_id === depId);
        if (depStep) {
          const key = `${depId}-${step.step_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            const isCrossScope = (depStep.scope || '') !== stepScope;
            // Highlight if either end is hovered
            const isHighlighted = hoveredStepId === step.step_id || hoveredStepId === depId;
            result.push({
              fromId: depId,
              toId: step.step_id,
              isHighlighted,
              isCrossScope,
            });
          }
        }
      }
    }

    return result;
  }, [steps, hoveredStepId]);

  if (lines.length === 0) {
    return null;
  }

  // Helper to create safe gradient IDs
  const safeId = (_from: string, _to: string, idx: number) => `gradient-${idx}`;

  return (
    <svg
      className="dependency-lines-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: dimensions.width,
        height: dimensions.height,
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Gradient from green (source/outgoing) to blue (target/incoming) */}
        {lines.map((line, idx) => {
          const fromRect = positions.get(line.fromId);
          const toRect = positions.get(line.toId);
          if (!fromRect || !toRect) return null;

          // Determine gradient direction based on relative positions
          const goingDown = toRect.y > fromRect.y;
          const goingRight = toRect.x > fromRect.x;

          return (
            <linearGradient
              key={safeId(line.fromId, line.toId, idx)}
              id={safeId(line.fromId, line.toId, idx)}
              x1={goingRight ? '0%' : '100%'}
              y1={goingDown ? '0%' : '100%'}
              x2={goingRight ? '100%' : '0%'}
              y2={goingDown ? '100%' : '0%'}
            >
              <stop offset="0%" stopColor="#22c55e" /> {/* Green at source */}
              <stop offset="100%" stopColor="#2563eb" /> {/* Blue at target */}
            </linearGradient>
          );
        })}
      </defs>

      {lines.map((line, idx) => {
        const fromRect = positions.get(line.fromId);
        const toRect = positions.get(line.toId);

        if (!fromRect || !toRect) return null;

        const path = generateOrthogonalPath(fromRect, toRect);
        const opacity = line.isHighlighted ? 1 : 0.4;
        const strokeWidth = line.isHighlighted ? 2.5 : 1.5;
        const gradientId = safeId(line.fromId, line.toId, idx);
        // Dashed for cross-scope, solid for same-scope
        const dashArray = line.isCrossScope ? '6 4' : undefined;

        return (
          <path
            key={`${line.fromId}-${line.toId}`}
            d={path}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            opacity={opacity}
            style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
          />
        );
      })}
    </svg>
  );
}

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

  // Compute dependency info for indicators - show ALL dependencies
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
        const isCrossScope = (depStep.scope || '') !== stepScope;
        if (isCrossScope) crossScopeIn = true;
        incoming.push({
          stepId: depStep.step_id,
          title: depStep.title,
          scope: isCrossScope ? depStep.scope : undefined,
        });
      }
    }

    // Outgoing: steps that depend on this step
    for (const s of allSteps) {
      if (s.dependencies?.includes(step.step_id)) {
        const isCrossScope = (s.scope || '') !== stepScope;
        if (isCrossScope) crossScopeOut = true;
        outgoing.push({
          stepId: s.step_id,
          title: s.title,
          scope: isCrossScope ? s.scope : undefined,
        });
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
      data-step-id={step.step_id}
      className={`relative w-44 min-h-20 p-3 border rounded-lg cursor-pointer flex flex-col gap-1 transition-all duration-200 ${baseClasses} ${
        isSelected || isHighlighted
          ? 'border-accent-cyan ring-2 ring-accent-cyan/50'
          : ''
      } ${isSelected ? 'bg-bg-elevated' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Dependency Indicators - show all dependencies */}
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
  maxColumn: number;
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
  maxColumn,
  onStepClick,
  selectedStepId,
  hoveredStepId,
  onStepHover,
  onIndicatorHover,
  onScrollToStep,
}: SwimlaneLaneProps) {
  // Group steps by column
  const stepsByColumn = useMemo(() => {
    const byCol = new Map<number, Step[]>();
    // Defensive check for HMR race conditions
    if (!columnMap) return byCol;
    for (const step of steps) {
      const col = columnMap.get(step.step_id) ?? 0;
      if (!byCol.has(col)) {
        byCol.set(col, []);
      }
      byCol.get(col)!.push(step);
    }
    return byCol;
  }, [steps, columnMap]);

  return (
    <div className="flex items-start border-b border-border-subtle min-h-32 py-4">
      {/* Fixed left label */}
      <div className="w-40 flex-shrink-0 sticky left-0 bg-bg-primary z-10 p-4 border-r border-border-subtle">
        <div className="text-sm font-semibold text-text-primary mb-1">
          {scope || 'General'}
        </div>
        <ScopeSummaryStats steps={steps} compact />
      </div>

      {/* Steps area - grid with fixed column widths */}
      {/* Column width = card (176px) + padding (12px each side) = 200px */}
      <div
        className="grid p-4 min-w-fit items-stretch"
        style={{
          gridTemplateColumns: `repeat(${maxColumn + 1}, 200px)`,
        }}
      >
        {Array.from({ length: maxColumn + 1 }, (_, colIndex) => {
          const colSteps = stepsByColumn.get(colIndex) || [];
          return (
            <div
              key={colIndex}
              className="flex flex-col gap-2 justify-center px-3"
            >
              {colSteps.map((step) => (
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
            </div>
          );
        })}
      </div>
      {steps.length === 0 && (
        <div className="p-4 text-sm text-text-muted italic">
          No steps in this scope
        </div>
      )}
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

  // Compute max column for grid sizing
  const maxColumn = useMemo(() => {
    let max = 0;
    // Defensive check for HMR race conditions
    if (!columnMap) return max;
    for (const col of columnMap.values()) {
      max = Math.max(max, col);
    }
    return max;
  }, [columnMap]);

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
      {/* Dependency lines (solid for same-scope, dashed for cross-scope) */}
      <DependencyLinesOverlay
        steps={steps}
        containerRef={containerRef}
        hoveredStepId={effectiveHoveredId}
      />

      {sortedScopes.map((scope) => (
        <SwimlaneLane
          key={scope || '__general__'}
          scope={scope}
          steps={scopeGroups.get(scope)!}
          allSteps={steps}
          columnMap={columnMap}
          maxColumn={maxColumn}
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
