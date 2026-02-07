import { useState } from 'react';
import { ScopeHeader } from './ScopeHeader';
import { StepNode } from './StepNode';
import type { StepWithExecution } from './ProjectTree';

/**
 * Props for WorkSection component
 */
export interface WorkSectionProps {
  /** Scope name (e.g., repo/team/domain) */
  scope: string;
  /** Steps in this scope */
  steps: StepWithExecution[];
  /** Whether this scope is currently focused */
  isFocused?: boolean;
  /** Whether to show steps (expanded state) */
  showSteps?: boolean;
  /** Callback when scope header is clicked */
  onScopeClick?: (scope: string) => void;
  /** Callback when a step is clicked */
  onStepClick?: (scope: string, stepId: string) => void;
  /** ID of currently focused step */
  focusedStepId?: string | null;
  /** Optional CSS class */
  className?: string;
}

/**
 * WorkSection
 *
 * Wraps a scope with its header and steps. Can be collapsed/expanded.
 * Used in ProjectTree to organize steps by scope (repo/team/domain).
 *
 * Features:
 * - Collapsible scope section with progress indicator
 * - Shows StepNode list when expanded
 * - Handles zoom interaction via callbacks
 * - Visual focus state for active scope
 *
 * @example
 * ```tsx
 * <WorkSection
 *   scope="api-service"
 *   steps={[...]}
 *   isFocused={true}
 *   showSteps={true}
 *   onScopeClick={(scope) => zoomToScope(scope)}
 *   onStepClick={(scope, stepId) => selectStep(stepId)}
 * />
 * ```
 */
export function WorkSection({
  scope,
  steps,
  isFocused = false,
  showSteps = false,
  onScopeClick,
  onStepClick,
  focusedStepId,
  className = '',
}: WorkSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(!showSteps);

  const handleHeaderClick = () => {
    // Toggle collapse state
    setIsCollapsed(!isCollapsed);
    // Notify parent for zoom interaction
    onScopeClick?.(scope);
  };

  const handleStepClick = (stepId: string) => {
    onStepClick?.(scope, stepId);
  };

  const shouldShowSteps = showSteps || !isCollapsed;

  return (
    <div className={`mb-2 ${className}`}>
      {/* Scope header with progress */}
      <ScopeHeader
        scope={scope}
        steps={steps}
        isFocused={isFocused}
        onClick={handleHeaderClick}
      />

      {/* Step list (when expanded) */}
      {shouldShowSteps && (
        <div className="mt-2 ml-2 space-y-1">
          {steps.map((step) => (
            <StepNode
              key={step.step_id}
              step={step}
              executionStatus={step.execution?.status}
              onClick={() => handleStepClick(step.step_id)}
              isFocused={focusedStepId === step.step_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
