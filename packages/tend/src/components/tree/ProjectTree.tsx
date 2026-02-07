import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingSpinner } from '../LoadingSpinner';
import { StepNode } from './StepNode';
import type { Step, StepExecutionStatus } from '@/types/plan';

/**
 * Zoom levels for project tree navigation
 * - OVERVIEW: All scopes visible with progress bars
 * - SCOPE: One scope expanded showing StepNode list
 * - STEP: Full step detail visible (future - will use sheets)
 */
export type ZoomLevel = 'overview' | 'scope' | 'step';

/**
 * Props for ProjectTree component
 */
export interface ProjectTreeProps {
  /** Plan ID to display */
  planId?: string;
  /** Current zoom level */
  zoomLevel?: ZoomLevel;
  /** Callback when zoom level changes */
  onZoomChange?: (level: ZoomLevel) => void;
  /** Callback when a step is selected */
  onStepSelect?: (stepId: string) => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * Execution info overlay (will be populated by forge later)
 */
export interface StepWithExecution extends Step {
  execution?: {
    status: StepExecutionStatus;
    started_at?: string;
    completed_at?: string;
    error?: string;
  };
}

/**
 * ProjectTree
 *
 * Replaces CuratedBlocksColumn with a zoomable project tree showing work
 * organized by scope (repo/team/domain).
 *
 * Features:
 * - Three zoom levels: OVERVIEW, SCOPE, STEP
 * - URL param sync: ?zoom=overview|scope|step&focus=scope-id.step-id
 * - Hierarchical navigation via breadcrumbs
 * - Real-time execution status overlay (when forge is running)
 *
 * Layout at each zoom level:
 * - OVERVIEW: Scope headers with progress bars (collapsed)
 * - SCOPE: One scope expanded showing StepNode list
 * - STEP: Full step detail (future - uses sheets)
 *
 * @example
 * ```tsx
 * <ProjectTree
 *   planId="plan-123"
 *   zoomLevel="scope"
 *   onZoomChange={(level) => console.log(level)}
 *   onStepSelect={(stepId) => console.log(stepId)}
 * />
 * ```
 */
export function ProjectTree({
  planId,
  zoomLevel: controlledZoom,
  onZoomChange,
  onStepSelect,
  className,
}: ProjectTreeProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // State for plan data
  const [steps, setSteps] = useState<StepWithExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Zoom state - sync with URL params
  const [internalZoom, setInternalZoom] = useState<ZoomLevel>('overview');
  const [focusedScope, setFocusedScope] = useState<string | null>(null);
  const [focusedStep, setFocusedStep] = useState<string | null>(null);

  const zoom = controlledZoom ?? internalZoom;

  // Read zoom state from URL on mount
  useEffect(() => {
    const zoomParam = searchParams.get('zoom') as ZoomLevel | null;
    const focusParam = searchParams.get('focus');

    if (zoomParam && ['overview', 'scope', 'step'].includes(zoomParam)) {
      setInternalZoom(zoomParam);
    }

    if (focusParam) {
      const parts = focusParam.split('.');
      if (parts.length === 1) {
        setFocusedScope(parts[0]);
      } else if (parts.length === 2) {
        setFocusedScope(parts[0]);
        setFocusedStep(parts[1]);
      }
    }
  }, [searchParams]);

  // Fetch plan data
  useEffect(() => {
    if (!planId) {
      setLoading(false);
      return;
    }

    const fetchPlan = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/plans/${planId}/versions/latest`);
        if (!res.ok) {
          throw new Error(`Failed to fetch plan: HTTP ${res.status}`);
        }
        const data = await res.json();
        setSteps(data.data.steps || []);
        setError(null);
      } catch (err) {
        console.error('[ProjectTree] Failed to fetch plan:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId]);

  // Group steps by scope
  const stepsByScope = useMemo(() => {
    const grouped = new Map<string, StepWithExecution[]>();

    for (const step of steps) {
      const scope = step.scope || 'unscoped';
      if (!grouped.has(scope)) {
        grouped.set(scope, []);
      }
      grouped.get(scope)!.push(step);
    }

    return grouped;
  }, [steps]);

  // Handle zoom changes
  const handleZoomChange = (newZoom: ZoomLevel, scope?: string, stepId?: string) => {
    setInternalZoom(newZoom);

    if (scope) {
      setFocusedScope(scope);
    }
    if (stepId) {
      setFocusedStep(stepId);
    }

    // Update URL params
    const params = new URLSearchParams();
    params.set('zoom', newZoom);

    if (scope && stepId) {
      params.set('focus', `${scope}.${stepId}`);
    } else if (scope) {
      params.set('focus', scope);
    }

    setSearchParams(params);

    // Notify parent
    onZoomChange?.(newZoom);
  };

  // Handle step selection
  const handleStepClick = (scope: string, stepId: string) => {
    if (zoom === 'overview') {
      // Zoom to scope level
      handleZoomChange('scope', scope);
    } else if (zoom === 'scope') {
      // Zoom to step level (or open sheet - future implementation)
      handleZoomChange('step', scope, stepId);
      onStepSelect?.(stepId);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-text-muted">Loading project tree...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-error mb-2">Failed to load project tree</p>
          <p className="text-sm text-text-muted">{error.message}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!planId || steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-text-muted">
          <p className="text-lg font-medium">No plan selected</p>
          <p className="text-sm mt-2">Select a project to view its tree</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 p-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
          Project Tree ({steps.length} steps, {stepsByScope.size} scopes)
        </h3>

        {/* Render scopes */}
        {Array.from(stepsByScope.entries()).map(([scope, scopeSteps]) => (
          <div key={scope} className="mb-2">
            <div className="px-3 py-2 bg-bg-elevated rounded-md">
              <div className="font-medium text-sm text-text-primary">{scope}</div>
              <div className="text-xs text-text-muted mt-1">
                {scopeSteps.length} step{scopeSteps.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Show steps when zoomed to scope or step level */}
            {(zoom === 'scope' || zoom === 'step') && focusedScope === scope && (
              <div className="mt-2 ml-2 space-y-1">
                {scopeSteps.map((step) => (
                  <StepNode
                    key={step.step_id}
                    step={step}
                    executionStatus={step.execution?.status}
                    onClick={() => handleStepClick(scope, step.step_id)}
                    isFocused={focusedStep === step.step_id}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
