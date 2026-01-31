import { WaveColumn } from './WaveColumn';
import type { WaveGroup } from '../../hooks/usePipelinePlans';

interface SequenceViewProps {
  waveGroups: WaveGroup[];
  onPlanClick?: (planId: string) => void;
  className?: string;
}

/**
 * Sequence view for pipeline - displays plans organized by dependency waves.
 *
 * Features:
 * - Horizontal scrolling layout with wave columns
 * - NOW column (cyan highlight) for ready-to-execute plans
 * - Wave 2, Wave 3, etc. for plans with dependencies
 * - DONE column (green accent) for completed plans
 * - Optional SVG overlay for dependency arrows (future enhancement)
 *
 * Layout approach:
 * - Kanban-style flex layout filling available width
 * - Each WaveColumn uses flex-1 to share space equally
 * - Columns separated by 1px border dividers
 * - Empty state handled by parent component
 *
 * Variant mapping:
 * - NOW -> variant="now" (cyan highlight)
 * - Wave N -> variant="default" (neutral)
 * - DONE -> variant="done" (green accent)
 *
 * Usage:
 * ```tsx
 * const { waveGroups } = usePipelinePlans();
 *
 * <SequenceView
 *   waveGroups={waveGroups}
 *   onPlanClick={(planId) => navigate(`/plans/${planId}`)}
 * />
 * ```
 */
export function SequenceView({
  waveGroups,
  className = '',
}: SequenceViewProps) {
  /**
   * Determine variant styling based on wave name.
   * NOW -> cyan highlight (ready to execute)
   * DONE -> green accent (completed)
   * Everything else -> default (neutral)
   */
  function getVariant(wave: string): 'now' | 'default' | 'done' {
    if (wave === 'NOW') return 'now';
    if (wave === 'DONE') return 'done';
    return 'default';
  }

  return (
    <div
      className={`
        flex h-full gap-px bg-border-subtle
        ${className}
      `}
    >
      {waveGroups.map((group) => (
        <WaveColumn
          key={group.wave}
          wave={group.wave}
          plans={group.plans}
          variant={getVariant(group.wave)}
        />
      ))}

      {/* Future enhancement: SVG overlay for dependency arrows */}
      {/*
        <svg className="absolute inset-0 pointer-events-none">
          {dependencies.map(dep => (
            <DependencyArrow key={dep.id} ... />
          ))}
        </svg>
      */}
    </div>
  );
}
