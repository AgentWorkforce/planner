import { cn } from '@/lib/utils';

export interface BreadcrumbSegment {
  label: string;
  level: 'project' | 'scope' | 'step';
  active: boolean;
}

export interface TreeBreadcrumbProps {
  segments: BreadcrumbSegment[];
  onSegmentClick?: (level: 'project' | 'scope' | 'step') => void;
}

/**
 * TreeBreadcrumb - Zoom path navigation
 *
 * Shows: Project > Scope Name > Step Title
 * Uses plain `>` separator to match ASCII tree aesthetic.
 */
export function TreeBreadcrumb({ segments, onSegmentClick }: TreeBreadcrumbProps) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm font-mono" aria-label="Tree navigation">
      {segments.map((segment, index) => {
        // Project segment renders as a terminal-style prompt character
        const isProject = segment.level === 'project';

        return (
          <span key={`${segment.level}-${index}`} className="flex items-center gap-1">
            {index > 0 && <span className="text-text-muted opacity-40">/</span>}
            <button
              type="button"
              onClick={() => onSegmentClick?.(segment.level)}
              className={cn(
                'transition-colors',
                isProject
                  ? 'text-text-muted opacity-40 hover:opacity-100 hover:text-text-primary cursor-pointer select-none'
                  : 'max-w-[150px] truncate',
                !isProject && segment.active
                  ? 'text-text-primary font-medium cursor-default'
                  : !isProject
                    ? 'text-text-secondary hover:text-accent-primary cursor-pointer'
                    : ''
              )}
              disabled={!isProject && segment.active}
              aria-label={isProject ? 'Back to overview' : undefined}
            >
              {isProject ? '█' : segment.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
