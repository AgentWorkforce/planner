import { cn } from '@/lib/utils';
import type { TreeStep } from './ProjectTree';

export interface StepNodeProps {
  step: TreeStep;
  isSelected?: boolean;
  isFocusedAwaitingClick?: boolean;
  onClick?: () => void;
}

/**
 * StepNode - Compact step in the ASCII tree
 *
 * No borders, no backgrounds, no badges.
 * Just: status char + title + dep count (plain text).
 * Selected/focused states use text color, not backgrounds.
 */
export function StepNode({ step, isSelected = false, isFocusedAwaitingClick = false, onClick }: StepNodeProps) {
  const status = step.execution_status || 'pending';

  const statusConfig = {
    pending: { icon: '○', className: 'text-text-muted' },
    running: { icon: '◉', className: 'text-accent-primary animate-pulse' },
    done: { icon: '✓', className: 'text-success' },
    blocked: { icon: '⚠', className: 'text-accent-secondary' },
    failed: { icon: '✗', className: 'text-accent-secondary' },
  };

  const { icon, className: statusClassName } = statusConfig[status];
  const hasDependencies = step.dependencies && step.dependencies.length > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 cursor-pointer transition-colors font-mono',
        'hover:text-text-primary',
        isSelected && 'text-accent-primary',
        isFocusedAwaitingClick && !isSelected && 'text-accent-primary/70',
        !isSelected && !isFocusedAwaitingClick && 'text-text-secondary'
      )}
    >
      {/* Status indicator */}
      <span className={cn('text-sm flex-shrink-0', statusClassName)}>
        {icon}
      </span>

      {/* Step title */}
      <span className="text-sm truncate">{step.title || 'Untitled Step'}</span>

      {/* Dot leaders */}
      <span className="flex-1 min-w-0 overflow-hidden text-text-muted select-none opacity-40 leading-none">
        {'·'.repeat(40)}
      </span>

      {/* Click hint for focused steps */}
      {isFocusedAwaitingClick && !isSelected && (
        <span className="flex-shrink-0 text-xs text-text-muted italic">
          click
        </span>
      )}

      {/* Dependency count — plain text */}
      {hasDependencies && !isFocusedAwaitingClick && (
        <span className="flex-shrink-0 text-xs text-text-muted tabular-nums">
          {step.dependencies.length}
        </span>
      )}
    </div>
  );
}
