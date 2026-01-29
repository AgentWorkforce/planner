import { Link } from 'react-router-dom';
import type { PlanSummary, AttentionType } from '@/types';
import { AttentionBadge } from './AttentionBadge';
import { getAttentionColor, getHighestPriorityAttention } from '@/utils/attention';
import { ChevronIcon } from '@/components/icons';

interface AttentionItemProps {
  plan: PlanSummary;
  timeContext: string;
  className?: string;
}

/**
 * Get the left accent bar color class based on attention type.
 */
function getAccentBarClass(type: AttentionType): string {
  const color = getAttentionColor(type);

  switch (color) {
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-error';
    case 'accent-purple':
      return 'bg-accent-purple';
    case 'accent-cyan':
      return 'bg-accent-cyan';
    case 'accent-blue':
      return 'bg-accent-cyan'; // fallback to cyan
    case 'success':
      return 'bg-success';
    case 'text-muted':
      return 'bg-text-muted/40';
    case 'text-dim':
      return 'bg-border-subtle';
    default:
      return 'bg-border-subtle';
  }
}

/**
 * Get the hover glow class based on attention type.
 */
function getHoverGlowClass(type: AttentionType): string {
  const color = getAttentionColor(type);

  switch (color) {
    case 'warning':
      return 'hover:shadow-[0_0_16px_rgba(255,107,53,0.15)]';
    case 'error':
      return 'hover:shadow-[0_0_20px_rgba(255,71,87,0.2)]';
    case 'accent-purple':
      return 'hover:shadow-[0_0_16px_rgba(168,85,247,0.15)]';
    case 'accent-cyan':
      return 'hover:shadow-[0_0_16px_rgba(0,217,255,0.15)]';
    case 'accent-blue':
      return 'hover:shadow-[0_0_16px_rgba(0,217,255,0.15)]';
    case 'success':
      return 'hover:shadow-[0_0_16px_rgba(0,255,200,0.15)]';
    default:
      return '';
  }
}

/**
 * Card component for plans in attention sections.
 *
 * Shows:
 * - Plan goal (truncated with ellipsis)
 * - AttentionBadge (compact) for primary attention type
 * - Time context (e.g., "submitted 2h ago")
 * - Left accent border colored by attention type
 * - Hover glow matching attention color
 *
 * Clicking navigates to /plans/{plan_id}
 */
export function AttentionItem({ plan, timeContext, className = '' }: AttentionItemProps) {
  const primaryAttention = getHighestPriorityAttention(plan);
  const accentBar = getAccentBarClass(primaryAttention);
  const hoverGlow = getHoverGlowClass(primaryAttention);

  return (
    <Link
      to={`/plans/${plan.plan_id}`}
      className={`group relative block bg-bg-card border border-border-subtle rounded-xl pl-5 pr-4 py-4 hover:border-border-light hover:bg-bg-hover/50 transition-all duration-150 ${hoverGlow} ${className}`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${accentBar}`} />

      <div className="flex items-center justify-between gap-3">
        {/* Left: Goal and metadata */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text-primary group-hover:text-accent-cyan transition-colors truncate mb-1.5">
            {plan.goal || 'Untitled Plan'}
          </h3>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>v{plan.latest_version}</span>
            {plan.scopes && plan.scopes.length > 0 && (
              <>
                <span className="text-text-dim">•</span>
                <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary text-xs">
                  {plan.scopes[0]}
                </span>
                {plan.scopes.length > 1 && (
                  <span className="text-xs text-text-dim">+{plan.scopes.length - 1}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Attention badge, time context, chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex flex-col items-end gap-1">
            <AttentionBadge type={primaryAttention} variant="compact" />
            <span className="text-xs text-text-muted whitespace-nowrap">{timeContext}</span>
          </div>
          <ChevronIcon
            size="sm"
            direction="right"
            className="text-text-muted group-hover:text-accent-cyan transition-colors"
          />
        </div>
      </div>
    </Link>
  );
}
