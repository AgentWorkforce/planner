import { cn } from '@/lib/utils';
import type { TreeStep } from './ProjectTree';

export interface StepNodeProps {
  step: TreeStep;
  isSelected?: boolean;
  isFocusedAwaitingClick?: boolean;
  onClick?: () => void;
}

/**
 * StepNode - Compact step representation in project tree
 *
 * Simplified from planner-ui StepEditor - NO editing, NO expansion.
 * Just displays step title + status indicator + dependency badge.
 *
 * Status indicators:
 * - ○ pending (muted)
 * - ⟳ running (accent + spin)
 * - ✓ done (success)
 * - ⚠ blocked (warning)
 * - ✗ failed (error)
 *
 * Features:
 * - Compact layout (text-xs to text-sm)
 * - Hover effect (bg-bg-hover)
 * - Selected state (border-l-2 + bg-bg-active)
 * - Focused state (subtle ring + hint text - awaiting second click)
 * - Dependency count badge
 */
export function StepNode({ step, isSelected = false, isFocusedAwaitingClick = false, onClick }: StepNodeProps) {
  const status = step.execution_status || 'pending';

  // Status icons and colors - attention levels applied
  // Level 0 (background): pending
  // Level 1 (info): running, done
  // Level 3 (urgent): blocked, failed
  const statusConfig = {
    pending: { icon: '○', className: 'text-text-muted' },
    running: { icon: '⟳', className: 'text-accent-primary animate-spin' },
    done: { icon: '✓', className: 'text-success' },
    blocked: { icon: '⚠', className: 'text-accent-secondary animate-pulse' },
    failed: { icon: '✗', className: 'text-accent-secondary' },
  };

  const { icon, className: statusClassName } = statusConfig[status];

  const hasDependencies = step.dependencies && step.dependencies.length > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all',
        'hover:bg-bg-hover',
        isSelected && 'border-l-2 border-accent-primary bg-bg-active',
        isFocusedAwaitingClick && !isSelected && 'border-l-2 border-accent-primary/50 bg-bg-hover ring-1 ring-accent-primary/30',
        !isSelected && !isFocusedAwaitingClick && 'border-l-2 border-transparent'
      )}
    >
      {/* Status indicator */}
      <span className={cn('text-sm flex-shrink-0', statusClassName)} title={status}>
        {icon}
      </span>

      {/* Step title */}
      <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{step.title || 'Untitled Step'}</span>

      {/* Click hint for focused steps */}
      {isFocusedAwaitingClick && !isSelected && (
        <span className="flex-shrink-0 text-xs text-text-muted italic">
          click for details
        </span>
      )}

      {/* Dependency count badge */}
      {hasDependencies && !isFocusedAwaitingClick && (
        <span
          className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-bg-tertiary text-text-secondary rounded"
          title={`${step.dependencies.length} dependencies`}
        >
          {step.dependencies.length}
        </span>
      )}
    </div>
  );
}
