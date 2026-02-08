import { cn } from '@/lib/utils';
import { ScopeHeader } from './ScopeHeader';
import { StepNode } from './StepNode';
import type { TreeStep } from './ProjectTree';

export interface WorkSectionProps {
  scope: string;
  steps: TreeStep[];
  isExpanded: boolean;
  workspacePath?: string | null;
  selectedStepId?: string;
  focusedStepId?: string;
  sheetOpen?: boolean;
  onScopeClick?: () => void;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

/**
 * WorkSection - Groups StepNode components under a scope
 *
 * Features:
 * - Collapsible via ScopeHeader
 * - Shows step list when expanded
 * - Compact layout for sidebar tree
 *
 * Behavior:
 * - Collapsed at OVERVIEW level
 * - Expanded at SCOPE/STEP level
 */
export function WorkSection({
  scope,
  steps,
  isExpanded,
  workspacePath,
  selectedStepId,
  focusedStepId,
  sheetOpen = false,
  onScopeClick,
  onStepClick,
  className,
}: WorkSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {/* Scope header */}
      <ScopeHeader scope={scope} steps={steps} isExpanded={isExpanded} workspacePath={workspacePath} onClick={onScopeClick} />

      {/* Step list (only when expanded) */}
      {isExpanded && (
        <div className="ml-4 space-y-0.5">
          {steps.length === 0 ? (
            <div className="px-2 py-2 text-xs text-text-muted">No steps in this scope</div>
          ) : (
            steps.map((step) => {
              const isFocused = focusedStepId === step.step_id;
              const isFocusedAwaitingClick = isFocused && !sheetOpen;

              return (
                <StepNode
                  key={step.step_id}
                  step={step}
                  isSelected={selectedStepId === step.step_id && sheetOpen}
                  isFocusedAwaitingClick={isFocusedAwaitingClick}
                  onClick={() => onStepClick?.(step.step_id)}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
