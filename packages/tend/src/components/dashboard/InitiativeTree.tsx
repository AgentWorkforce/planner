import { useState } from 'react';
import { cn } from '@/lib/utils';
import { HealthIndicator } from './HealthIndicator';

interface Initiative {
  initiative_id: string;
  name: string;
}

interface SessionSummary {
  id: string;
  status: 'active' | 'abandoned';
  initiative_id?: string;
  source: { type: string; initial_intent: string };
  blocks: Array<{ id: string; status: string }>;
  planner_sends: Array<{ result?: { plan_id: string } }>;
  created_at: string;
  updated_at: string;
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
  sessions: SessionSummary[];
  plans: PlanSummary[];
  healthMap?: Map<string, HealthScore>;
  onSelectSession: (sessionId: string) => void;
  onSelectPlan?: (planId: string) => void;
  onNewSession: () => void;
}

const TITLE_MAX_LEN = 40;
const GOAL_MAX_LEN = 45;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function getStatusBadgeClasses(status: string): string {
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
}

interface SessionRowProps {
  session: SessionSummary;
  sessionPlans: PlanSummary[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelectSession: (id: string) => void;
  onSelectPlan?: (planId: string) => void;
}

function SessionRow({
  session,
  sessionPlans,
  isExpanded,
  onToggle,
  onSelectSession,
  onSelectPlan,
}: SessionRowProps) {
  const title = truncate(session.source.initial_intent || 'Untitled session', TITLE_MAX_LEN);
  const blockCount = session.blocks?.length ?? 0;
  const planCount = sessionPlans.length;
  const hasChildren = planCount > 0;

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* Expand toggle — only rendered when there are child plans */}
        <button
          onClick={hasChildren ? onToggle : () => onSelectSession(session.id)}
          className={cn(
            'flex items-center gap-2 flex-1 px-2 py-1.5 text-sm rounded text-left',
            'hover:bg-bg-secondary transition-colors'
          )}
        >
          <span className="text-text-muted text-xs font-mono w-3 shrink-0">
            {hasChildren ? (isExpanded ? '▾' : '▸') : '·'}
          </span>
          <span className="text-text-secondary flex-1 truncate" title={session.source.initial_intent}>
            {title}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {blockCount > 0 && (
              <span className="text-[10px] text-text-muted bg-bg-tertiary px-1 rounded">
                {blockCount}b
              </span>
            )}
            {planCount > 0 && (
              <span className="text-[10px] text-text-muted bg-bg-tertiary px-1 rounded">
                {planCount}p
              </span>
            )}
          </div>
        </button>

        {/* Separate navigation button when there are children (so the row still expands on click) */}
        {hasChildren && (
          <button
            onClick={() => onSelectSession(session.id)}
            className="px-1 py-1.5 text-text-muted hover:text-text-secondary transition-colors"
            title="Open session"
          >
            <span className="text-xs">›</span>
          </button>
        )}
      </div>

      {isExpanded && planCount > 0 && (
        <div className="ml-5 space-y-0.5 mt-0.5">
          {sessionPlans.map((plan) => (
            <button
              key={plan.plan_id}
              onClick={() => onSelectPlan?.(plan.plan_id)}
              disabled={!onSelectPlan}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left',
                onSelectPlan
                  ? 'hover:bg-bg-secondary cursor-pointer transition-colors'
                  : 'cursor-default'
              )}
            >
              <span className="text-text-muted text-xs font-mono shrink-0">└</span>
              <span className="flex-1 truncate text-text-primary text-xs" title={plan.goal}>
                {truncate(plan.goal, GOAL_MAX_LEN)}
              </span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                  getStatusBadgeClasses(plan.status)
                )}
              >
                {plan.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InitiativeTree({
  initiatives,
  sessions,
  plans,
  healthMap,
  onSelectSession,
  onSelectPlan,
  onNewSession,
}: InitiativeTreeProps) {
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(new Set());
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

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

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Build plan lookup by session: plan_id → session_id
  // Also collect plan_ids that belong to sessions so we can find orphans
  const planIdToSessionId = new Map<string, string>();
  sessions.forEach((s) => {
    s.planner_sends?.forEach((send) => {
      if (send.result?.plan_id) {
        planIdToSessionId.set(send.result.plan_id, s.id);
      }
    });
  });

  // Build session → plans lookup
  const plansBySession = new Map<string, PlanSummary[]>();
  plans.forEach((plan) => {
    const sessionId = planIdToSessionId.get(plan.plan_id);
    if (sessionId) {
      const bucket = plansBySession.get(sessionId) ?? [];
      bucket.push(plan);
      plansBySession.set(sessionId, bucket);
    }
  });

  // Plans with no associated session (legacy / orphan data)
  const orphanPlans = plans.filter((p) => !planIdToSessionId.has(p.plan_id));

  // Sessions grouped by initiative
  const sessionsByInitiative = new Map<string | undefined, SessionSummary[]>();
  sessions.forEach((s) => {
    const key = s.initiative_id;
    const bucket = sessionsByInitiative.get(key) ?? [];
    bucket.push(s);
    sessionsByInitiative.set(key, bucket);
  });

  // Unassigned sessions (no initiative_id)
  const unassignedSessions = sessionsByInitiative.get(undefined) ?? [];

  // Orphan plans assigned to initiatives but without a session
  const orphanPlansByInitiative = new Map<string | null, PlanSummary[]>();
  orphanPlans.forEach((plan) => {
    const key = plan.initiative_id;
    const bucket = orphanPlansByInitiative.get(key) ?? [];
    bucket.push(plan);
    orphanPlansByInitiative.set(key, bucket);
  });

  const unassignedOrphanPlans = orphanPlansByInitiative.get(null) ?? [];

  return (
    <div className="space-y-1">
      {/* Initiatives */}
      {initiatives.map((initiative) => {
        const isExpanded = expandedInitiatives.has(initiative.initiative_id);
        const healthScore = healthMap?.get(initiative.initiative_id);
        const initiativeSessions = sessionsByInitiative.get(initiative.initiative_id) ?? [];
        const initiativeOrphanPlans = orphanPlansByInitiative.get(initiative.initiative_id) ?? [];
        const hasChildren = initiativeSessions.length > 0 || initiativeOrphanPlans.length > 0;

        return (
          <div key={initiative.initiative_id}>
            <button
              onClick={() => hasChildren && toggleInitiative(initiative.initiative_id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left',
                'hover:bg-bg-secondary transition-colors',
                !hasChildren && 'cursor-default'
              )}
            >
              <span className="text-text-muted text-xs font-mono">
                {!hasChildren ? '·' : isExpanded ? '▼' : '▶'}
              </span>
              <span className="text-text-primary font-medium flex-1">
                {initiative.name}
              </span>
              {healthScore && (
                <HealthIndicator score={healthScore.overall} size="sm" />
              )}
            </button>

            {isExpanded && hasChildren && (
              <div className="ml-3 space-y-0.5 mt-0.5">
                {/* Sessions under this initiative */}
                {initiativeSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    sessionPlans={plansBySession.get(session.id) ?? []}
                    isExpanded={expandedSessions.has(session.id)}
                    onToggle={() => toggleSession(session.id)}
                    onSelectSession={onSelectSession}
                    onSelectPlan={onSelectPlan}
                  />
                ))}

                {/* Orphan plans under this initiative (no associated session) */}
                {initiativeOrphanPlans.map((plan) => (
                  <button
                    key={plan.plan_id}
                    onClick={() => onSelectPlan?.(plan.plan_id)}
                    disabled={!onSelectPlan}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left',
                      onSelectPlan
                        ? 'hover:bg-bg-secondary cursor-pointer transition-colors'
                        : 'cursor-default'
                    )}
                  >
                    <span className="text-text-muted text-xs font-mono shrink-0">└</span>
                    <span className="flex-1 truncate text-text-secondary text-xs" title={plan.goal}>
                      {truncate(plan.goal, GOAL_MAX_LEN)}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                        getStatusBadgeClasses(plan.status)
                      )}
                    >
                      {plan.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned section — sessions and orphan plans with no initiative */}
      {(unassignedSessions.length > 0 || unassignedOrphanPlans.length > 0) && (
        <div>
          <div className="px-2 py-1.5 text-xs text-text-muted font-medium uppercase tracking-wide">
            Unassigned
          </div>
          <div className="ml-3 space-y-0.5">
            {unassignedSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                sessionPlans={plansBySession.get(session.id) ?? []}
                isExpanded={expandedSessions.has(session.id)}
                onToggle={() => toggleSession(session.id)}
                onSelectSession={onSelectSession}
                onSelectPlan={onSelectPlan}
              />
            ))}

            {unassignedOrphanPlans.map((plan) => (
              <button
                key={plan.plan_id}
                onClick={() => onSelectPlan?.(plan.plan_id)}
                disabled={!onSelectPlan}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left',
                  onSelectPlan
                    ? 'hover:bg-bg-secondary cursor-pointer transition-colors'
                    : 'cursor-default'
                )}
              >
                <span className="text-text-muted text-xs font-mono shrink-0">└</span>
                <span className="flex-1 truncate text-text-secondary text-xs" title={plan.goal}>
                  {truncate(plan.goal, GOAL_MAX_LEN)}
                </span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                    getStatusBadgeClasses(plan.status)
                  )}
                >
                  {plan.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New conversation button */}
      <button
        onClick={onNewSession}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-2 py-2 text-sm rounded',
          'border border-border-default border-dashed',
          'hover:bg-bg-secondary hover:border-solid transition-colors',
          'text-text-secondary hover:text-text-primary'
        )}
      >
        <span className="text-xs">+</span>
        <span>new conversation</span>
      </button>
    </div>
  );
}
