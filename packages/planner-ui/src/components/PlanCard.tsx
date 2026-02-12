import { Link } from 'react-router-dom';
import type { PlanSummary, PlanStatus } from '@/types';
import { InitiativeBadge } from '@/components/plans/InitiativeBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { AgentActivityDot } from '@/components/AgentActivityDot';
import { QuestionsBadge } from '@/components/QuestionsBadge';
import { formatRelativeTime } from '@/utils/time';

interface PlanCardProps {
  plan: PlanSummary;
  className?: string;
}

/**
 * Get the CSS classes for a status badge.
 * Returns inline styles for colors since Tailwind doesn't support dynamic classes.
 */
function getStatusBadgeClass(status: PlanStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-warning/10 text-warning';
    case 'approved':
      return 'bg-success/10 text-success';
    case 'published':
      return 'bg-accent-cyan/10 text-accent-cyan';
    default:
      return 'bg-text-secondary/10 text-text-secondary';
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
 * Stacked-cards icon for coordination plan badge.
 */
function StackedCardsIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="10" height="10" rx="1.5" />
      <rect x="5" y="1" width="10" height="10" rx="1.5" />
    </svg>
  );
}

/**
 * Coordination plan card — visually distinct from leaf plans.
 *
 * Taller card with:
 * - Gradient accent bar (cyan→purple) instead of solid status color
 * - "N plans" badge prominent next to the title
 * - Scope chips row showing which domains the plan spans
 * - Standard metadata row beneath
 */
function CoordinationPlanCard({ plan, className = '' }: PlanCardProps) {
  const pendingQuestions = plan.pending_questions ?? 0;
  const agentActive = plan.agent_active ?? false;
  const subPlanCount = plan.sub_plan_ids?.length ?? 0;
  const scopes = plan.scopes ?? [];

  return (
    <Link
      to={`/plans/${plan.plan_id}`}
      className={`group relative block bg-transparent border border-border-subtle/60 rounded-[2px] pl-5 pr-4 py-4 overflow-hidden hover:border-accent-cyan/30 transition-all duration-150 hover:shadow-[0_0_20px_rgba(0,217,255,0.08)] ${className}`}
    >
      {/* Row 1: Title area with gradient accent bar */}
      <div className="relative flex items-stretch min-h-7 mb-2 -ml-5 -mr-4 -mt-4">
        {/* Gradient accent bar — cyan-to-purple signals coordination */}
        <div
          className="w-[3px] flex-shrink-0"
          style={{ background: 'linear-gradient(180deg, var(--color-accent-cyan), var(--color-accent-purple))' }}
        />

        <div className="flex-1 flex flex-col justify-center px-4 py-[7px] bg-white dark:bg-bg-card min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-medium text-text-primary group-hover:text-accent-cyan transition-colors truncate">
              {plan.goal || 'Untitled Plan'}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-accent-cyan/10 text-accent-cyan text-xs font-medium whitespace-nowrap flex-shrink-0">
              <StackedCardsIcon className="w-3 h-3" />
              {subPlanCount} {subPlanCount === 1 ? 'plan' : 'plans'}
            </span>
            <AgentActivityDot active={agentActive} />
          </div>
          {plan.context && (
            <p className="text-sm text-text-muted mt-0.5 line-clamp-1">
              {plan.context}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Scope chips — what domains this coordination plan spans */}
      {scopes.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {scopes.map((scope) => (
            <span
              key={scope}
              className="px-2 py-0.5 rounded-sm bg-accent-purple/8 text-accent-purple/80 text-xs border border-accent-purple/10"
            >
              {scope}
            </span>
          ))}
        </div>
      )}

      {/* Row 3: Metadata */}
      <div className="flex items-center gap-2 text-sm text-text-muted flex-wrap">
        {plan.initiative && (
          <>
            <InitiativeBadge initiative={plan.initiative} size="sm" />
            <span className="text-text-dim">•</span>
          </>
        )}

        <span>v{plan.latest_version}</span>
        <span className="text-text-dim">•</span>
        <span>{formatRelativeTime(plan.updated_at)}</span>

        {pendingQuestions > 0 && (
          <>
            <span className="text-text-dim">•</span>
            <QuestionsBadge count={pendingQuestions} />
          </>
        )}

        <span className="flex-1" />
        <span
          className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium uppercase ${getStatusBadgeClass(plan.status)}`}
        >
          {plan.status}
        </span>
      </div>

    </Link>
  );
}

/**
 * Reusable plan card component.
 *
 * Renders two distinct layouts:
 * - **Coordination plan** (has sub_plan_ids): taller card with gradient accent,
 *   prominent "N plans" badge, scope chips row
 * - **Leaf plan**: compact two-row card with solid status accent bar
 *
 * Same component used across /plans and /initiatives/:id routes.
 */
export function PlanCard({ plan, className = '' }: PlanCardProps) {
  const subPlanCount = plan.sub_plan_ids?.length ?? 0;

  // Coordination plans get a distinct card treatment
  if (subPlanCount > 0) {
    return <CoordinationPlanCard plan={plan} className={className} />;
  }

  const stepCount = plan.step_count ?? 0;
  const completedStepCount = plan.completed_step_count ?? 0;
  const pendingQuestions = plan.pending_questions ?? 0;
  const agentActive = plan.agent_active ?? false;

  return (
    <Link
      to={`/plans/${plan.plan_id}`}
      className={`group relative block bg-transparent border border-transparent rounded-[2px] pl-5 pr-4 py-4 overflow-hidden hover:border-border-subtle transition-all duration-150 ${getHoverGlowClass(plan.status)} ${className}`}
    >
      {/* Row 1: Title + Description + Activity */}
      <div className="relative flex items-stretch min-h-7 mb-2 -ml-5 -mr-4 -mt-4">
        {/* Left accent bar */}
        <div
          className={`w-[3px] flex-shrink-0 ${getAccentBarClass(plan.status)}`}
        />

        {/* White background area with title */}
        <div className="flex-1 flex flex-col justify-center px-4 py-[7px] bg-white dark:bg-bg-card min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-text-primary group-hover:text-accent-cyan transition-colors truncate">
              {plan.goal || 'Untitled Plan'}
            </h2>
            <AgentActivityDot active={agentActive} />
          </div>
          {plan.context && (
            <p className="text-sm text-text-muted mt-0.5">
              {plan.context}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Initiative + Scopes + Progress + Version + Time + Questions + Status */}
      <div className="flex items-center gap-2 text-sm text-text-muted flex-wrap">
        {plan.initiative && (
          <>
            <InitiativeBadge initiative={plan.initiative} size="sm" />
            <span className="text-text-dim">•</span>
          </>
        )}

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

        {stepCount > 0 && (
          <>
            <span className="text-xs text-text-secondary">
              {completedStepCount}/{stepCount}
            </span>
            <span className="text-text-dim">•</span>
          </>
        )}

        <span>v{plan.latest_version}</span>
        <span className="text-text-dim">•</span>
        <span>{formatRelativeTime(plan.updated_at)}</span>

        {pendingQuestions > 0 && (
          <>
            <span className="text-text-dim">•</span>
            <QuestionsBadge count={pendingQuestions} />
          </>
        )}

        {/* Spacer + Status badge (right-aligned) */}
        <span className="flex-1" />
        <span
          className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium uppercase ${getStatusBadgeClass(plan.status)}`}
        >
          {plan.status}
        </span>
      </div>

      {/* Bottom progress bar - 4px at absolute bottom */}
      {stepCount > 0 && (
        <ProgressBar completed={completedStepCount} total={stepCount} />
      )}
    </Link>
  );
}
