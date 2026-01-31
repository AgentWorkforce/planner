import { forwardRef } from 'react';
import type { PlanSummary, PlanStatus } from '@/types';

interface PlanResultItemProps {
  plan: PlanSummary;
  isSelected?: boolean;
  onClick?: () => void;
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
 * Get compact badge classes for status.
 */
function getStatusBadgeClasses(status: PlanStatus): string {
  const color = getStatusColor(status);
  return `px-1.5 py-0.5 text-xs font-medium rounded bg-${color}/10 text-${color}`;
}

/**
 * Truncate a string to a max length with ellipsis.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Individual result row for command palette.
 *
 * Shows plan goal (truncated), status badge, and scope tags.
 * Supports hover and selected states.
 * Forwards ref for scroll-into-view behavior.
 */
export const PlanResultItem = forwardRef<HTMLButtonElement, PlanResultItemProps>(
  function PlanResultItem({ plan, isSelected = false, onClick }, ref) {
    const goal = plan.goal || 'Untitled Plan';
    const truncatedGoal = truncate(goal, 60);
    const firstScope = plan.scopes && plan.scopes.length > 0 ? plan.scopes[0] : null;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-left transition-all duration-150 ${
          isSelected
            ? 'bg-accent-cyan/10 text-accent-cyan'
            : 'hover:bg-bg-hover text-text-primary'
        }`}
      >
        {/* Plan goal */}
        <span className={`flex-1 min-w-0 text-sm truncate ${isSelected ? 'text-text-primary font-medium' : ''}`}>
          {truncatedGoal}
        </span>

        {/* First scope as subtle tag */}
        {firstScope && (
          <span className="text-xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded flex-shrink-0">
            {firstScope}
          </span>
        )}

        {/* Status badge */}
        <span className={`${getStatusBadgeClasses(plan.status)} flex-shrink-0`}>{plan.status}</span>
      </button>
    );
  }
);
