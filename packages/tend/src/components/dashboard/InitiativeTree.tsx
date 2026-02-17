import { useState } from 'react';
import { cn } from '@/lib/utils';
import { HealthIndicator } from './HealthIndicator';

interface Initiative {
  initiative_id: string;
  name: string;
}

interface PlanSummary {
  plan_id: string;
  goal: string;
  status: string;
  initiative_id: string | null;
  phase?: 'ideating' | 'planning' | 'forging' | null;
}

interface HealthScore {
  entity_type: 'initiative' | 'plan';
  entity_id: string;
  overall: number;
}

interface InitiativeTreeProps {
  initiatives: Initiative[];
  plans: PlanSummary[];
  healthMap?: Map<string, HealthScore>;
  onSelectPlan?: (planId: string) => void;
  onNewPlan?: () => void;
}

export function InitiativeTree({
  initiatives,
  plans,
  healthMap,
  onSelectPlan,
  onNewPlan,
}: InitiativeTreeProps) {
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(
    new Set(initiatives.map((i) => i.initiative_id))
  );

  const toggleInitiative = (initiativeId: string) => {
    setExpandedInitiatives((prev) => {
      const next = new Set(prev);
      if (next.has(initiativeId)) {
        next.delete(initiativeId);
      } else {
        next.add(initiativeId);
      }
      return next;
    });
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-amber-600 bg-amber-50';
      case 'approved':
        return 'text-emerald-600 bg-emerald-50';
      case 'published':
        return 'text-text-muted bg-bg-secondary';
      default:
        return 'text-text-muted bg-bg-secondary';
    }
  };

  const sortPlans = (planList: PlanSummary[]) => {
    const statusOrder: Record<string, number> = {
      draft: 0,
      approved: 1,
      published: 2,
    };
    return [...planList].sort((a, b) => {
      const aOrder = statusOrder[a.status] ?? 3;
      const bOrder = statusOrder[b.status] ?? 3;
      return aOrder - bOrder;
    });
  };

  const assignedPlans = plans.filter((p) => p.initiative_id !== null);
  const unassignedPlans = plans.filter((p) => p.initiative_id === null);

  return (
    <div className="space-y-1">
      {initiatives.map((initiative) => {
        const isExpanded = expandedInitiatives.has(initiative.initiative_id);
        const initiativePlans = sortPlans(
          assignedPlans.filter((p) => p.initiative_id === initiative.initiative_id)
        );
        const healthScore = healthMap?.get(initiative.initiative_id);

        return (
          <div key={initiative.initiative_id}>
            <button
              onClick={() => toggleInitiative(initiative.initiative_id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded',
                'hover:bg-bg-secondary transition-colors',
                'text-left'
              )}
            >
              <span className="text-text-muted text-xs font-mono">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="text-text-primary font-medium flex-1">
                {initiative.name}
              </span>
              {healthScore && (
                <HealthIndicator score={healthScore.overall} size="sm" />
              )}
            </button>

            {isExpanded && initiativePlans.length > 0 && (
              <div className="ml-3 space-y-0.5 mt-0.5">
                {initiativePlans.map((plan) => (
                  <button
                    key={plan.plan_id}
                    onClick={() => onSelectPlan?.(plan.plan_id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded',
                      'hover:bg-bg-secondary transition-colors',
                      'text-left'
                    )}
                  >
                    <span className="text-text-muted text-xs font-mono">└</span>
                    <span className="text-text-primary flex-1 truncate">
                      {plan.goal}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          getStatusBadgeClasses(plan.status)
                        )}
                      >
                        {plan.status}
                      </span>
                      {plan.phase && (
                        <span className="text-[10px] text-text-muted">
                          {plan.phase}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {unassignedPlans.length > 0 && (
        <div>
          <div className="px-2 py-1.5 text-sm text-text-secondary font-medium">
            Unassigned
          </div>
          <div className="ml-3 space-y-0.5">
            {sortPlans(unassignedPlans).map((plan) => (
              <button
                key={plan.plan_id}
                onClick={() => onSelectPlan?.(plan.plan_id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded',
                  'hover:bg-bg-secondary transition-colors',
                  'text-left'
                )}
              >
                <span className="text-text-muted text-xs font-mono">└</span>
                <span className="text-text-primary flex-1 truncate">
                  {plan.goal}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-medium',
                      getStatusBadgeClasses(plan.status)
                    )}
                  >
                    {plan.status}
                  </span>
                  {plan.phase && (
                    <span className="text-[10px] text-text-muted">
                      {plan.phase}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {onNewPlan && (
        <button
          onClick={onNewPlan}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-2 py-2 text-sm rounded',
            'border border-border-default border-dashed',
            'hover:bg-bg-secondary hover:border-solid transition-colors',
            'text-text-secondary hover:text-text-primary'
          )}
        >
          <span className="text-xs">+</span>
          <span>new</span>
        </button>
      )}
    </div>
  );
}
