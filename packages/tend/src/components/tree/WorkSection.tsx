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
  hideHeader?: boolean;
  onScopeClick?: () => void;
  onStepClick?: (stepId: string) => void;
  className?: string;
  /** Step title highlighted from ForgeLogView cross-link */
  crossFocusedStepName?: string | null;
}

/**
 * WorkSection - ASCII tree structure with box-drawing connectors
 *
 * When expanded, renders steps with ├─ / └─ connectors and │ vertical trunk.
 *
 * ```
 * ▼ scope-name                  0/6
 *   packages/scope/
 *   │
 *   ├─ ○ Step one                 1
 *   ├─ ○ Step two                 2
 *   └─ ○ Step three
 * ```
 */
export function WorkSection({
  scope,
  steps,
  isExpanded,
  workspacePath,
  selectedStepId,
  focusedStepId,
  sheetOpen = false,
  hideHeader = false,
  onScopeClick,
  onStepClick,
  className,
  crossFocusedStepName,
}: WorkSectionProps) {
  return (
    <div className={cn('font-mono', className)}>
      {/* Scope header — hidden when breadcrumb already shows scope */}
      {!hideHeader && (
        <ScopeHeader
          scope={scope}
          steps={steps}
          isExpanded={isExpanded}
          workspacePath={workspacePath}
          onClick={onScopeClick}
        />
      )}

      {/* Step list with box-drawing connectors */}
      {isExpanded && (
        <div className={cn('text-sm', !hideHeader && 'ml-4')}>
          {steps.length === 0 ? (
            <div className="flex items-center">
              <span className="text-text-muted opacity-40 mr-1 select-none">└─</span>
              <span className="text-xs text-text-muted italic">no steps</span>
            </div>
          ) : (
            steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const isFocused = focusedStepId === step.step_id;
              const isFocusedAwaitingClick = isFocused && !sheetOpen;
              const isCrossFocused = crossFocusedStepName === step.title;
              const connector = isLast ? '└─' : '├─';

              return (
                <div
                  key={step.step_id}
                  data-step-title={step.title}
                  className={cn(
                    'flex items-center rounded transition-all duration-300',
                    isCrossFocused && 'ring-1 ring-accent-primary/60',
                  )}
                >
                  {/* Box-drawing connector */}
                  <span className="text-text-muted opacity-40 flex-shrink-0 mr-1 select-none">
                    {connector}
                  </span>

                  {/* Step content */}
                  <div className="flex-1 min-w-0 py-0">
                    <StepNode
                      step={step}
                      isSelected={selectedStepId === step.step_id && sheetOpen}
                      isFocusedAwaitingClick={isFocusedAwaitingClick}
                      onClick={() => onStepClick?.(step.step_id)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
