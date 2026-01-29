import { Link } from 'react-router-dom';
import type { PlanSummary, PlanStatus } from '@/types';
import { ChevronIcon } from '@/components/icons';

interface PlanCardProps {
  plan: PlanSummary;
  className?: string;
}

/**
 * Get the design system color for a plan status.
 */
function getStatusColor(status: PlanStatus): string {
  switch (status) {
    case 'draft':
      return 'warning';
    case 'approved':
      return 'success';
    case 'published':
      return 'accent-cyan';
    default:
      return 'text-secondary';
  }
}

/**
 * Get the CSS classes for a status badge.
 */
function getStatusBadgeClasses(status: PlanStatus): string {
  const color = getStatusColor(status);
  return `inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide bg-${color}/10 text-${color}`;
}

/**
 * Get the accent bar color class based on status.
 */
function getAccentBarClass(status: PlanStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-warning';
    case 'approved':
      return 'bg-success';
    case 'published':
      return 'bg-accent-cyan';
    default:
      return 'bg-border-subtle';
  }
}

/**
 * Get hover glow effect based on status.
 */
function getHoverGlowClass(status: PlanStatus): string {
  switch (status) {
    case 'draft':
      return 'hover:shadow-[0_0_16px_rgba(255,107,53,0.12)]';
    case 'approved':
      return 'hover:shadow-[0_0_16px_rgba(0,255,200,0.12)]';
    case 'published':
      return 'hover:shadow-[0_0_16px_rgba(0,217,255,0.15)]';
    default:
      return '';
  }
}

/**
 * Reusable plan card component.
 *
 * Displays plan goal, status badge, scopes, version, and date.
 * Links to the plan editor page.
 */
export function PlanCard({ plan, className = '' }: PlanCardProps) {
  return (
    <Link
      to={`/plans/${plan.plan_id}`}
      className={`group relative block bg-bg-card border border-border-subtle rounded-xl pl-5 pr-4 py-4 hover:border-border-light hover:bg-bg-hover/50 transition-all duration-150 ${getHoverGlowClass(plan.status)} ${className}`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${getAccentBarClass(plan.status)}`}
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-text-primary group-hover:text-accent-cyan transition-colors truncate mb-1.5">
            {plan.goal || 'Untitled Plan'}
          </h2>

          <div className="flex items-center gap-2 text-sm text-text-muted">
            {plan.scopes && plan.scopes.length > 0 && (
              <>
                <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary text-xs">
                  {plan.scopes[0]}
                </span>
                {plan.scopes.length > 1 && (
                  <span className="text-xs text-text-dim">+{plan.scopes.length - 1}</span>
                )}
                <span className="text-text-dim">•</span>
              </>
            )}
            <span>v{plan.latest_version}</span>
            <span className="text-text-dim">•</span>
            <span>{new Date(plan.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={getStatusBadgeClasses(plan.status)}>{plan.status}</span>
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
