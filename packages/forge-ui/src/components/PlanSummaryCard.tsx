/**
 * PlanSummaryCard - Displays plan overview for preflight
 *
 * Shows the plan goal, stats (steps, scopes, gates), and version badge.
 */

import { cn } from '@/lib/utils';
import type { ForgePlan } from '@/types';

interface PlanSummaryCardProps {
  plan: ForgePlan;
  className?: string;
}

export function PlanSummaryCard({ plan, className }: PlanSummaryCardProps) {
  // Calculate stats
  const stepCount = plan.steps.length;
  const scopes = [...new Set(plan.steps.map((s) => s.scope).filter(Boolean))];
  const scopeCount = scopes.length;
  const gateCount = plan.steps.filter((s) => s.gate).length;

  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-surface p-6',
        className
      )}
    >
      {/* Plan Goal as Title */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold text-text-primary">
          {plan.goal}
        </h2>
        {/* Version Badge */}
        <span className="shrink-0 rounded-md bg-accent-cyan/10 px-2 py-1 text-sm font-medium text-accent-cyan">
          v{plan.plan_version}
        </span>
      </div>

      {/* Stats Row */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
        {/* Steps */}
        <div className="flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-text-muted"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span>
            {stepCount} {stepCount === 1 ? 'step' : 'steps'}
          </span>
        </div>

        {/* Scopes */}
        {scopeCount > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-text-muted"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>
              {scopeCount} {scopeCount === 1 ? 'scope' : 'scopes'}
            </span>
          </div>
        )}

        {/* Gates */}
        {gateCount > 0 && (
          <div className="flex items-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-amber-500"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-amber-500">
              {gateCount} {gateCount === 1 ? 'gate' : 'gates'}
            </span>
          </div>
        )}
      </div>

      {/* Scopes list */}
      {scopes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {scopes.map((scope) => (
            <span
              key={scope}
              className="rounded bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary"
            >
              {scope}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
