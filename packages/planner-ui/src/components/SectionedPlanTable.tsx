import { Link } from 'react-router-dom';
import type { PlanSummary, PlanStatus } from '@/types';
import { AgentActivityDot } from '@/components/AgentActivityDot';
import { QuestionsBadge } from '@/components/QuestionsBadge';
import { formatCompactTime } from '@/utils/time';
import { EditIcon, ChevronIcon } from '@/components/icons';

interface SectionedPlanTableProps {
  /** Plans grouped by scope name */
  scopeGroups: Map<string, PlanSummary[]>;
  /** Sorted scope names for display order */
  sortedScopeNames: string[];
  /** Check if a scope is expanded */
  isExpanded: (scopeName: string) => boolean;
  /** Toggle expansion for a scope */
  onToggle: (scopeName: string) => void;
  className?: string;
}

/**
 * Get status pill classes (background + text color).
 */
function getStatusPillClass(status: PlanStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-warning/20 text-warning';
    case 'approved':
      return 'bg-bg-tertiary text-text-muted';
    case 'published':
      return 'bg-accent-cyan/20 text-accent-cyan';
    default:
      return 'bg-bg-tertiary text-text-secondary';
  }
}

/**
 * Sectioned table view - table rows grouped under collapsible scope headers.
 * Inspired by Linear's sectioned list view.
 */
export function SectionedPlanTable({
  scopeGroups,
  sortedScopeNames,
  isExpanded,
  onToggle,
  className = '',
}: SectionedPlanTableProps) {
  if (sortedScopeNames.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        No plans found
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header row */}
      <div className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wide bg-bg-secondary/30 border-b border-border-subtle rounded-t">
        <div className="w-5 flex-shrink-0" /> {/* Chevron column */}
        <div className="w-3 flex-shrink-0" /> {/* Initiative circle column */}
        <div className="flex-1 min-w-0">Plan</div>
        <div className="w-24 text-center">Status</div>
        <div className="w-10">
          <EditIcon size="sm" className="text-text-muted" />
        </div>
        <div className="w-14 text-center">Progress</div>
      </div>

      {/* Scope sections */}
      {sortedScopeNames.map((scopeName) => {
        const plans = scopeGroups.get(scopeName) || [];
        const expanded = isExpanded(scopeName);

        return (
          <div key={scopeName}>
            {/* Section header */}
            <button
              type="button"
              onClick={() => onToggle(scopeName)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-bg-secondary/50 hover:bg-bg-secondary/70 transition-colors border-b border-border-subtle text-left"
            >
              <ChevronIcon
                size="sm"
                direction={expanded ? 'down' : 'right'}
                className="text-text-muted"
              />
              <span className="text-sm font-medium text-text-secondary">
                {scopeName}
              </span>
              <span className="text-xs text-text-muted ml-1">
                {plans.length}
              </span>
            </button>

            {/* Section rows */}
            {expanded && plans.map((plan, index) => {
              const stepCount = plan.step_count ?? 0;
              const completedStepCount = plan.completed_step_count ?? 0;
              const pendingQuestions = plan.pending_questions ?? 0;
              const agentActive = plan.agent_active ?? false;
              const progressPercent = stepCount > 0 ? (completedStepCount / stepCount) * 100 : 0;

              return (
                <Link
                  key={plan.plan_id}
                  to={`/plans/${plan.plan_id}`}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover/40 transition-colors border-b border-border-subtle/50 last:border-b-0 ${
                    index % 2 === 1 ? 'bg-bg-secondary/10' : ''
                  }`}
                >
                  {/* Indent spacer (matches chevron width) */}
                  <div className="w-5 flex-shrink-0" />

                  {/* Initiative circle */}
                  <div className="w-3 flex-shrink-0 flex justify-center">
                    {plan.initiative ? (
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: plan.initiative.color || '#00d9ff' }}
                        title={plan.initiative.name}
                      />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-bg-tertiary" />
                    )}
                  </div>

                  {/* Plan title + activity indicators */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-normal text-text-primary group-hover:text-accent-cyan transition-colors truncate">
                      {plan.goal || 'Untitled Plan'}
                    </span>
                    {agentActive && <AgentActivityDot active />}
                    {pendingQuestions > 0 && <QuestionsBadge count={pendingQuestions} />}
                  </div>

                  {/* Status pill */}
                  <div className="w-24 flex-shrink-0 flex justify-center">
                    <span className={`inline-flex items-center justify-center min-w-[4.5rem] px-3 py-0.5 rounded-full text-xs font-normal uppercase ${getStatusPillClass(plan.status)}`}>
                      {plan.status}
                    </span>
                  </div>

                  {/* Updated time */}
                  <div className="w-10 flex-shrink-0">
                    <span className="text-text-dim text-sm">
                      {formatCompactTime(plan.updated_at)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-14 flex-shrink-0 flex items-center">
                    {stepCount > 0 ? (
                      <div className="w-full h-1 bg-border-subtle rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-cyan rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    ) : (
                      <span className="text-text-dim text-sm">—</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
