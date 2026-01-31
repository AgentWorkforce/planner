import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import type { InitiativeWithPlanCounts, InitiativeStatus } from '@/types/initiative';

interface InitiativeCardProps {
  initiative: InitiativeWithPlanCounts;
  className?: string;
}

/**
 * Get Badge variant based on initiative status
 */
function getStatusBadgeVariant(status: InitiativeStatus): 'success' | 'info' | 'default' {
  switch (status) {
    case 'active':
      return 'success';
    case 'completed':
      return 'info';
    case 'archived':
      return 'default';
  }
}

/**
 * Get hover glow effect based on initiative status
 */
function getHoverGlowClass(status: InitiativeStatus): string {
  switch (status) {
    case 'active':
      return 'hover:shadow-[0_0_16px_rgba(0,255,200,0.12)]';
    case 'completed':
      return 'hover:shadow-[0_0_16px_rgba(0,217,255,0.15)]';
    default:
      return '';
  }
}

/**
 * Get the status display text
 */
function getStatusLabel(status: InitiativeStatus): string {
  return status;
}


/**
 * Reusable initiative card component.
 *
 * Displays initiative icon, name, description preview, status badge,
 * and plan count statistics. Links to initiative detail page.
 *
 * @example
 * <InitiativeCard initiative={initiative} />
 */
export function InitiativeCard({ initiative, className = '' }: InitiativeCardProps) {
  const iconBgColor = initiative.color || '#00d9ff';

  return (
    <Link
      to={`/initiatives/${initiative.initiative_id}`}
      className={`group block bg-bg-card border border-border-subtle rounded-xl p-4 hover:border-accent-cyan/50 hover:bg-bg-hover/50 transition-all duration-150 ${getHoverGlowClass(initiative.status)} ${className}`}
    >
      {/* Header row: icon + name */}
      <div className="flex items-start gap-3 mb-3">
        {/* Icon with colored background */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ backgroundColor: `${iconBgColor}20` }}
        >
          <span className="text-lg leading-none" role="img" aria-label="Initiative icon">
            {initiative.icon || '🎯'}
          </span>
        </div>

        {/* Name and status badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-semibold text-text-primary group-hover:text-accent-cyan transition-colors truncate">
              {initiative.name}
            </h3>
            <Badge
              variant={getStatusBadgeVariant(initiative.status)}
              className="flex-shrink-0"
            >
              {getStatusLabel(initiative.status)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Description preview */}
      <div className="mb-3 min-h-[2.5rem]">
        {initiative.description ? (
          <p className="text-sm text-text-secondary line-clamp-2">
            {initiative.description}
          </p>
        ) : (
          <p className="text-sm text-text-dim italic">
            No description
          </p>
        )}
      </div>

      {/* Stats bar: plan counts */}
      <div className="flex items-center gap-2 text-xs text-text-muted pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-text-secondary">
            {initiative.plan_counts.total}
          </span>
          <span>
            {initiative.plan_counts.total === 1 ? 'plan' : 'plans'}
          </span>
        </div>

        {initiative.plan_counts.total > 0 && (
          <>
            <span className="text-text-dim">•</span>
            <div className="flex items-center gap-2 flex-wrap">
              {initiative.plan_counts.draft > 0 && (
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-warning"
                    aria-hidden="true"
                  />
                  <span>{initiative.plan_counts.draft} draft</span>
                </div>
              )}
              {initiative.plan_counts.approved > 0 && (
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-success"
                    aria-hidden="true"
                  />
                  <span>{initiative.plan_counts.approved} approved</span>
                </div>
              )}
              {initiative.plan_counts.published > 0 && (
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-accent-cyan"
                    aria-hidden="true"
                  />
                  <span>{initiative.plan_counts.published} published</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
