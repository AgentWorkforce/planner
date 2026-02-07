import { cn } from '@/lib/utils';
import type { Step, StepExecutionStatus } from '@/types/plan';

/**
 * Props for StepNode component
 */
export interface StepNodeProps {
  /** Step data to display */
  step: Step;
  /** Optional execution status overlay */
  executionStatus?: StepExecutionStatus;
  /** Click handler for step selection */
  onClick?: () => void;
  /** Whether this step is currently focused */
  isFocused?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * Get status indicator symbol based on execution status
 */
function getStatusIndicator(status?: StepExecutionStatus): string {
  switch (status) {
    case 'done':
      return '✓';
    case 'running':
      return '⟳';
    case 'blocked':
      return '⊗';
    case 'failed':
      return '✗';
    case 'pending':
    default:
      return '○';
  }
}

/**
 * Get status color based on execution status
 */
function getStatusColor(status?: StepExecutionStatus): string {
  switch (status) {
    case 'done':
      return 'text-green-600';
    case 'running':
      return 'text-blue-600 animate-spin';
    case 'blocked':
      return 'text-yellow-600';
    case 'failed':
      return 'text-red-600';
    case 'pending':
    default:
      return 'text-gray-400';
  }
}

/**
 * StepNode
 *
 * Simplified, compact view of a step for the project tree.
 * Adapted from planner-ui's StepEditor component, but focuses on
 * display rather than editing (editing happens in sheets).
 *
 * Features:
 * - Compact single-line display: status indicator + title
 * - Status indicators: ○ pending, ⟳ running, ✓ done, ⊗ blocked, ✗ failed
 * - Click to select (triggers zoom or sheet opening)
 * - Hover state for interactivity
 * - Optional scope badge
 *
 * Design:
 * - No inline editing (simplified from StepEditor)
 * - No expand/collapse (full detail in sheets)
 * - No delete buttons (tree is read-only)
 * - Clean, minimal aesthetic matching earth-tone palette
 *
 * @example
 * ```tsx
 * <StepNode
 *   step={step}
 *   executionStatus="running"
 *   onClick={() => handleStepClick(step.step_id)}
 *   isFocused={focusedStepId === step.step_id}
 * />
 * ```
 */
export function StepNode({
  step,
  executionStatus,
  onClick,
  isFocused = false,
  className,
}: StepNodeProps) {
  const statusIndicator = getStatusIndicator(executionStatus);
  const statusColorClass = getStatusColor(executionStatus);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150',
        'border border-border-subtle hover:border-border',
        isFocused
          ? 'bg-accent-cyan/10 border-accent-cyan'
          : 'bg-bg-card hover:bg-bg-elevated',
        className
      )}
    >
      {/* Status indicator */}
      <span
        className={cn(
          'flex-shrink-0 text-base font-mono',
          statusColorClass
        )}
        title={executionStatus ? `Status: ${executionStatus}` : 'Pending'}
        aria-label={executionStatus ? `Status: ${executionStatus}` : 'Pending'}
      >
        {statusIndicator}
      </span>

      {/* Step title */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm font-medium truncate transition-colors',
            isFocused ? 'text-accent-cyan' : 'text-text-primary'
          )}
        >
          {step.title}
        </div>
      </div>

      {/* Scope badge (if present) */}
      {step.scope && (
        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-bg-elevated text-text-secondary rounded border border-border-subtle">
          {step.scope}
        </span>
      )}

      {/* Dependency count indicator (if any dependencies) */}
      {step.dependencies.length > 0 && (
        <span
          className="flex-shrink-0 text-xs text-text-muted"
          title={`${step.dependencies.length} dependencies`}
        >
          ←{step.dependencies.length}
        </span>
      )}

      {/* Gate indicator (if approval required) */}
      {step.gate && (
        <span
          className="flex-shrink-0 text-xs text-yellow-600"
          title="Approval gate"
          aria-label="Requires approval"
        >
          🛡
        </span>
      )}
    </div>
  );
}
