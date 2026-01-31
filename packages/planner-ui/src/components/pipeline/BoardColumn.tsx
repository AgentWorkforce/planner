import { PipelinePlanCard } from './PipelinePlanCard';
import type { PlanSummary } from '@/types';

type BoardVariant = 'default' | 'gate' | 'running' | 'complete';

interface BoardColumnProps {
  title: string;
  plans: PlanSummary[];
  variant?: BoardVariant;
  onPlanClick?: (planId: string) => void;
  className?: string;
}

/**
 * Column component for BoardView (Kanban workflow states).
 *
 * Features:
 * - Header with title and plan count badge
 * - Vertical stack of PipelinePlanCard components
 * - Variant-specific styling (gate highlight, running accent, complete success)
 * - Flex-1 to share available width (Kanban-style)
 *
 * Variants:
 * - default: Standard column (Drafting, Approved)
 * - gate: Orange highlight with glow (Gate - awaiting approval)
 * - running: Cyan accent (Running - active execution)
 * - complete: Green accent (Complete - finished)
 *
 * Usage:
 * ```tsx
 * <BoardColumn
 *   title="Gate"
 *   plans={gateStatusPlans}
 *   variant="gate"
 * />
 * ```
 */
export function BoardColumn({
  title,
  plans,
  variant = 'default',
  className = '',
}: BoardColumnProps) {
  // Variant-specific styling
  const variantStyles = {
    default: 'bg-bg-secondary/20 rounded-lg border border-border-subtle',
    gate: 'bg-accent-orange/10 rounded-lg border-t-2 border-accent-orange shadow-glow-orange',
    running: 'bg-accent-cyan/5 rounded-lg border border-accent-cyan/30',
    complete: 'bg-accent-green/5 rounded-lg border border-accent-green/20',
  };

  return (
    <div
      className={`
        flex-1 min-w-0
        ${variantStyles[variant]}
        p-3
        ${className}
      `}
    >
      {/* Header: title + count */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-sm text-text-primary">{title}</h2>
        <span className="text-text-muted text-sm">
          {plans.length}
        </span>
      </div>

      {/* Plan cards stack */}
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <PipelinePlanCard
            key={plan.plan_id}
            plan={plan}
          />
        ))}

        {/* Empty column message */}
        {plans.length === 0 && (
          <div className="text-center text-text-muted text-sm py-4">
            No plans
          </div>
        )}
      </div>
    </div>
  );
}
