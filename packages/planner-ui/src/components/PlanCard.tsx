import { Link } from 'react-router-dom';
import type { PlanSummary, PlanStatus } from '@/types';
import { ChevronIcon } from '@/components/icons';
import { InitiativeBadge } from '@/components/plans/InitiativeBadge';

interface PlanCardProps {
  plan: PlanSummary;
  className?: string;
}

/**
 * Get the CSS classes for a status badge.
 * Returns inline styles for colors since Tailwind doesn't support dynamic classes.
 */
function getStatusBadgeStyles(status: PlanStatus): { bg: string; text: string } {
  switch (status) {
    case 'draft':
      return { bg: 'rgba(255, 107, 53, 0.1)', text: '#ff6b35' }; // warning
    case 'approved':
      return { bg: 'rgba(0, 255, 200, 0.1)', text: '#00ffc8' }; // success
    case 'published':
      return { bg: 'rgba(0, 217, 255, 0.1)', text: '#00d9ff' }; // accent-cyan
    default:
      return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8' }; // text-secondary
  }
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

          {plan.initiative && (
            <div className="mt-2 mb-1.5">
              <InitiativeBadge initiative={plan.initiative} size="sm" />
            </div>
          )}

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
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: getStatusBadgeStyles(plan.status).bg,
              color: getStatusBadgeStyles(plan.status).text,
            }}
          >
            {plan.status}
          </span>
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
