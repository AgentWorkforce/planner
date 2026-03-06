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
 *
 * Trailing indicators (right-to-left priority):
 * 1. Click hint when focused awaiting second click
 * 2. Stall warning for running steps
 * 3. Satisfaction score for completed steps
 * 4. Dependency count otherwise
 */
export function StepNode({ step, isSelected = false, isFocusedAwaitingClick = false, onClick }: StepNodeProps) {
  const status = step.execution_status || 'pending';
  const { icon, className: iconClassName } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const hasDependencies = step.dependencies && step.dependencies.length > 0;

  const trailing = (
    <>
      {/* Click hint for focused steps — takes priority over everything else */}
      {isFocusedAwaitingClick && !isSelected && (
        <span className="flex-shrink-0 text-xs text-text-muted italic">
          click
        </span>
      )}

      {/* Escalation indicator — needs attention */}
      {!isFocusedAwaitingClick && step.escalation && (
        <span
          className={cn(
            'flex-shrink-0 text-xs text-amber-400',
            (step.escalation.type === 'gate' || step.escalation.type === 'question') && 'animate-pulse'
          )}
          title={step.escalation.detail}
        >
          ⚡
        </span>
      )}

      {/* Stall warning for running steps */}
      {!isFocusedAwaitingClick && !step.escalation && step.stallWarning && status === 'running' && (
        <span
          className="flex-shrink-0 text-xs text-amber-400 animate-pulse"
          title="Agent may be stalled"
        >
          !
        </span>
      )}

      {/* Satisfaction score for completed steps */}
      {!isFocusedAwaitingClick && !step.escalation && step.score !== undefined && status === 'done' && (
        <span
          className={cn(
            'flex-shrink-0 text-xs tabular-nums',
            step.score >= 80 ? 'text-success' : step.score >= 50 ? 'text-text-muted' : 'text-accent-secondary'
          )}
          title={`Satisfaction score: ${step.score}/100`}
        >
          {step.score}
        </span>
      )}

      {/* Merge status for completed steps */}
      {!isFocusedAwaitingClick && !step.escalation && step.mergeStatus && status === 'done' && step.score === undefined && (
        <span
          className={cn(
            'flex-shrink-0 text-xs',
            step.mergeStatus === 'merged' ? 'text-success' :
            step.mergeStatus === 'failed' ? 'text-accent-secondary' :
            step.mergeStatus === 'merging' ? 'text-accent-primary animate-pulse' :
            'text-text-muted'
          )}
          title={`Merge: ${step.mergeStatus}${step.mergeBranch ? ` (${step.mergeBranch})` : ''}`}
        >
          {step.mergeStatus === 'merged' ? '↑✓' :
           step.mergeStatus === 'failed' ? '↑✗' :
           step.mergeStatus === 'merging' ? '↑' :
           step.mergeStatus === 'skipped' ? '—' : '↑'}
        </span>
      )}

      {/* Dependency count — only when no other indicator shown */}
      {hasDependencies && !isFocusedAwaitingClick && !step.escalation && step.score === undefined && !step.stallWarning && !step.mergeStatus && (
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
