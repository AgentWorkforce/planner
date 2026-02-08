import { cn } from '@/lib/utils';
import { ChevronIcon } from '@/components/icons';

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
 *
 * Each segment clickable to zoom out to that level.
 * Chevron separator between segments.
 *
 * Styling:
 * - Non-active segments: text-text-secondary
 * - Active segment: text-text-primary font-medium
 * - Chevron: text-text-muted
 */
export function TreeBreadcrumb({ segments, onSegmentClick }: TreeBreadcrumbProps) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs" aria-label="Tree navigation">
      {segments.map((segment, index) => (
        <span key={`${segment.level}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronIcon direction="right" size="sm" className="text-text-muted" />}
          <button
            type="button"
            onClick={() => onSegmentClick?.(segment.level)}
            className={cn(
              'transition-colors max-w-[150px] truncate',
              segment.active
                ? 'text-text-primary font-medium cursor-default'
                : 'text-text-secondary hover:text-accent-primary cursor-pointer'
            )}
            disabled={segment.active}
          >
            {segment.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
