import { PipelinePlanCard } from './PipelinePlanCard';
import { WaveIcon } from '@/components/icons';
import type { PlanSummary } from '@/types';

type WaveVariant = 'now' | 'default' | 'done';

interface WaveColumnProps {
  wave: string;  // 'NOW', 'Wave 2', etc., or 'DONE'
  plans: PlanSummary[];
  variant?: WaveVariant;
  onPlanClick?: (planId: string) => void;
  className?: string;
}

/**
 * Column component for SequenceView (dependency waves).
 *
 * Features:
 * - Header with wave name, optional wave icon, and plan count badge
 * - Vertical stack of PipelinePlanCard components
 * - Variant-specific styling (NOW highlighted cyan, DONE success green)
 * - Flex-1 to share available width (Kanban-style)
 * - Overflow scroll if content exceeds height
 *
 * Variants:
 * - now: Cyan highlight (NOW - ready to execute, no dependencies)
 * - default: Standard column (Wave 2, Wave 3, etc.)
 * - done: Green accent (DONE - completed plans)
 *
 * Usage:
 * ```tsx
 * <WaveColumn
 *   wave="NOW"
 *   plans={nowPlans}
 *   variant="now"
 * />
 * <WaveColumn
 *   wave="Wave 2"
 *   plans={wave2Plans}
 *   variant="default"
 * />
 * ```
 */
export function WaveColumn({
  wave,
  plans,
  variant = 'default',
  className = '',
}: WaveColumnProps) {
  // Variant-specific styling
  const variantStyles = {
    now: 'bg-accent-cyan/5 border-t-2 border-accent-cyan/30',
    default: 'bg-bg-secondary/30 border-r border-border-subtle last:border-r-0',
    done: 'bg-accent-green/5 border-t-2 border-accent-green/20',
  };

  // Show wave icon for numbered waves (not NOW or DONE)
  const showWaveIcon = !['NOW', 'DONE'].includes(wave);

  return (
    <div
      className={`
        flex-1 min-w-0 flex flex-col
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {/* Header: wave name + icon + count */}
      <div className="flex items-center justify-between p-3 pb-2 border-b border-border-subtle/50">
        <div className="flex items-center gap-2">
          {showWaveIcon && (
            <WaveIcon className="w-4 h-4 text-text-secondary" />
          )}
          <h2 className="font-medium text-sm text-text-secondary uppercase tracking-wide">
            {wave}
          </h2>
        </div>
        <span className="px-2 py-0.5 rounded bg-bg-tertiary text-text-muted text-xs font-medium">
          {plans.length}
        </span>
      </div>

      {/* Plan cards stack - scrollable */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {plans.map((plan) => (
          <PipelinePlanCard
            key={plan.plan_id}
            plan={plan}
          />
        ))}

        {/* Empty column message */}
        {plans.length === 0 && (
          <div className="text-center text-text-muted text-sm py-8">
            No plans
          </div>
        )}
      </div>
    </div>
  );
}
