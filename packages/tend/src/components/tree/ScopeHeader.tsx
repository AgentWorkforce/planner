import { cn } from '@/lib/utils';
import { ChevronIcon } from '@/components/icons';
import type { TreeStep } from './ProjectTree';

export interface ScopeHeaderProps {
  scope: string;
  steps: TreeStep[];
  isExpanded: boolean;
  workspacePath?: string | null;
  onClick?: () => void;
}

/**
 * ScopeHeader - Scope name + progress bar
 *
 * Shows scope name, count of done/total steps, and a progress bar.
 * Clickable to toggle/zoom scope.
 *
 * Progress calculation:
 * - Total = steps.length
 * - Done = steps with execution_status === 'done'
 * - Percentage = (done / total) * 100
 *
 * Color scheme:
 * - Progress bar: bg-accent-primary (moss green)
 * - Text: text-text-primary
 * - Chevron: text-text-muted
 */
export function ScopeHeader({ scope, steps, isExpanded, workspacePath, onClick }: ScopeHeaderProps) {
  const total = steps.length;
  const done = steps.filter((s) => s.execution_status === 'done').length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
        'hover:bg-bg-hover',
        'border border-border-subtle'
      )}
    >
      {/* Chevron */}
      <ChevronIcon size="sm" direction={isExpanded ? 'down' : 'right'} className="text-text-muted flex-shrink-0" />

      {/* Scope name and workspace path */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-text-primary">{scope || 'Default Scope'}</span>
        {workspacePath && (
          <span className="text-xs text-text-muted font-mono truncate">{workspacePath}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className="h-full bg-accent-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-text-secondary flex-shrink-0">
          {done}/{total}
        </span>
      </div>
    </div>
  );
}
