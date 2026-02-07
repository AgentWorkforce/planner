import type { StepWithExecution } from './ProjectTree';

/**
 * Props for ScopeHeader component
 */
export interface ScopeHeaderProps {
  /** Scope name (e.g., repo/team/domain) */
  scope: string;
  /** Steps in this scope */
  steps: StepWithExecution[];
  /** Whether this scope is currently focused */
  isFocused?: boolean;
  /** Callback when header is clicked (for zoom interaction) */
  onClick?: () => void;
  /** Optional CSS class */
  className?: string;
}

/**
 * ScopeHeader
 *
 * Header for a scope section showing name, step count, and progress.
 * Clickable to expand/collapse or zoom to scope level.
 *
 * Progress calculation:
 * - Completed: execution status is 'done'
 * - Total: all steps in scope
 * - Progress bar: fraction of completed steps
 *
 * Style: Earth-tone palette with subtle borders and hover states
 *
 * @example
 * ```tsx
 * <ScopeHeader
 *   scope="api-service"
 *   steps={[...]}
 *   isFocused={true}
 *   onClick={() => zoomToScope('api-service')}
 * />
 * ```
 */
export function ScopeHeader({
  scope,
  steps,
  isFocused = false,
  onClick,
  className = '',
}: ScopeHeaderProps) {
  // Calculate progress
  const completedSteps = steps.filter(
    (step) => step.execution?.status === 'done'
  ).length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full px-3 py-2
        bg-bg-elevated border border-border-subtle rounded-md
        hover:bg-bg-hover hover:border-border-default
        transition-colors duration-150
        text-left
        ${isFocused ? 'ring-2 ring-accent-green ring-offset-1' : ''}
        ${className}
      `}
    >
      {/* Scope name and step count */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-medium text-sm text-text-primary">{scope}</div>
        <div className="text-xs text-text-muted">
          {completedSteps}/{totalSteps}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-green transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </button>
  );
}
