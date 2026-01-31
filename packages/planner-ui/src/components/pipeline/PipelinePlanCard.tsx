import { Link } from 'react-router-dom';
import type { PlanSummary } from '@/types';

interface PipelinePlanCardProps {
  plan: PlanSummary;
  className?: string;
}

/**
 * Compact plan card for pipeline views (Sequence and Board).
 *
 * Displays:
 * - Goal text (line-clamp-2 truncation)
 * - Initiative badge (if plan.initiative exists)
 * - Status dot (colored circle, not full badge)
 * - Gate indicator (red pulsing dot when awaiting approval)
 *
 * More compact than PlanCard - designed for dense pipeline columns.
 * Entire card is clickable and navigates to plan editor.
 *
 * Usage:
 * ```tsx
 * <PipelinePlanCard plan={planSummary} />
 * ```
 */
export function PipelinePlanCard({ plan, className = '' }: PipelinePlanCardProps) {
  const hasGate = plan.attention_types?.includes('gate_pending');
  const isApproved = plan.status === 'approved';
  const isPublished = plan.status === 'published';

  return (
    <Link
      to={`/plans/${plan.plan_id}`}
      className={`
        block bg-bg-card rounded-lg p-3
        border transition-all duration-150
        ${hasGate
          ? 'border-accent-orange shadow-glow-orange'
          : 'border-border-subtle hover:border-accent-cyan/50'
        }
        ${className}
      `}
    >
      {/* Goal - truncated to 2 lines */}
      <h3 className="font-medium text-sm text-text-primary line-clamp-2 mb-2">
        {plan.goal || 'Untitled Plan'}
      </h3>

      <div className="flex items-center justify-between gap-2">
        {/* Initiative badge (left) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {plan.initiative && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-bg-tertiary text-xs text-text-secondary truncate">
              {plan.initiative.icon && (
                <span className="flex-shrink-0">{plan.initiative.icon}</span>
              )}
              <span className="truncate">{plan.initiative.name}</span>
            </div>
          )}
        </div>

        {/* Status + Gate indicators (right) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Gate indicator - red pulsing dot */}
          {hasGate && (
            <div
              className="w-2 h-2 rounded-full bg-accent-orange animate-pulse"
              title="Awaiting approval"
            />
          )}

          {/* Status dot */}
          <div
            className={`w-2 h-2 rounded-full ${
              plan.status === 'draft'
                ? 'bg-text-muted'
                : isApproved
                ? 'bg-accent-cyan'
                : isPublished
                ? 'bg-accent-green'
                : 'bg-text-dim'
            }`}
            title={plan.status}
          />
        </div>
      </div>
    </Link>
  );
}
