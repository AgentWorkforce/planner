import { cn } from '@/lib/utils';
import type { TreeStep } from './ProjectTree';
import { TreeNodeLayout } from './TreeNodeLayout';

export interface StepNodeProps {
  step: TreeStep;
  isSelected?: boolean;
  isFocusedAwaitingClick?: boolean;
  onClick?: () => void;
}

const STATUS_MAP: Record<string, { icon: string; className: string }> = {
  pending: { icon: '○', className: 'text-text-muted' },
  running: { icon: '◉', className: 'text-accent-primary animate-pulse' },
  done: { icon: '✓', className: 'text-success' },
  blocked: { icon: '⚠', className: 'text-accent-secondary' },
  failed: { icon: '✗', className: 'text-accent-secondary' },
};

/**
 * StepNode - Compact step in the ASCII tree
 *
 * No borders, no backgrounds, no badges.
 * Just: status char + title + dep count (plain text).
 * Selected/focused states use text color, not backgrounds.
 */
export function StepNode({ step, isSelected = false, isFocusedAwaitingClick = false, onClick }: StepNodeProps) {
  const status = step.execution_status || 'pending';
  const { icon, className: iconClassName } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const hasDependencies = step.dependencies && step.dependencies.length > 0;

  const trailing = (
    <>
      {/* Click hint for focused steps */}
      {isFocusedAwaitingClick && !isSelected && (
        <span className="flex-shrink-0 text-xs text-text-muted italic">
          click
        </span>
      )}

      {/* Dependency count — plain text */}
      {hasDependencies && !isFocusedAwaitingClick && (
        <span className={cn('flex-shrink-0 text-xs text-text-muted tabular-nums')}>
          {step.dependencies.length}
        </span>
      )}
    </>
  );

  return (
    <TreeNodeLayout
      icon={icon}
      iconClassName={iconClassName}
      label={step.title || 'Untitled Step'}
      trailing={trailing}
      isSelected={isSelected}
      isFocusedAwaitingClick={isFocusedAwaitingClick}
      onClick={onClick}
    />
  );
}
