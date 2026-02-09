import { cn } from '@/lib/utils';
import type { TreeStep } from './ProjectTree';

export interface ScopeHeaderProps {
  scope: string;
  steps: TreeStep[];
  isExpanded: boolean;
  workspacePath?: string | null;
  onClick?: () => void;
}

/**
 * ScopeHeader - Scope name with expand/collapse indicator
 *
 * ASCII-style: ▶/▼ prefix, monospace font, plain done/total count.
 * No borders, no progress bars, no card styling.
 */
export function ScopeHeader({ scope, steps, isExpanded, onClick }: ScopeHeaderProps) {
  const total = steps.length;
  const done = steps.filter((s) => s.execution_status === 'done').length;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-0 cursor-pointer transition-colors font-mono text-sm',
        'hover:text-text-primary'
      )}
    >
      {/* Expand/collapse indicator */}
      <span className="text-xs text-text-muted flex-shrink-0 w-3 leading-5">
        {isExpanded ? '▼' : '▶'}
      </span>

      {/* Scope name + dot leaders + count */}
      <span className="text-sm font-medium text-text-primary">{scope || 'default'}</span>
      <span className="flex-1 min-w-0 overflow-hidden text-text-muted select-none opacity-40 leading-none">
        {'·'.repeat(40)}
      </span>
      <span className="text-xs text-text-muted flex-shrink-0 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}
