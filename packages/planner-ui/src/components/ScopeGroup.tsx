import { ChevronIcon } from '@/components/icons';
import { PlanCard } from './PlanCard';
import type { PlanSummary } from '@/types';

interface ScopeGroupProps {
  scopeName: string;
  plans: PlanSummary[];
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Collapsible scope group that displays plans belonging to a scope.
 *
 * Features:
 * - Click header to toggle expand/collapse
 * - Shows scope name + plan count
 * - Collapse state can be controlled externally or via localStorage
 * - Animated open/close with max-height transition
 * - 'Uncategorized' scope sorted last (handled by parent)
 */
export function ScopeGroup({ scopeName, plans, isExpanded, onToggle }: ScopeGroupProps) {
  const count = plans.length;
  const isUncategorized = scopeName === 'Uncategorized';

  // Determine display name for the scope
  const displayName = isUncategorized ? 'Uncategorized' : scopeName;

  return (
    <div className="mb-4">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="group relative w-full flex items-center justify-between pl-4 pr-3 py-2.5 hover:bg-bg-hover/50 rounded-lg transition-all duration-150"
      >
        {/* Left accent bar */}
        <div
          className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full ${
            isUncategorized ? 'bg-text-dim/50' : 'bg-accent-purple/70'
          }`}
        />
        <div className="flex items-center gap-2.5">
          <ChevronIcon
            size="sm"
            direction="down"
            className={`text-text-muted group-hover:text-text-secondary transition-all duration-200 ${
              !isExpanded ? '-rotate-90' : ''
            }`}
          />
          <span className={`font-medium ${isUncategorized ? 'text-text-muted' : 'text-text-primary'}`}>
            {displayName}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isUncategorized ? 'bg-bg-tertiary/50 text-text-dim' : 'bg-accent-purple/10 text-accent-purple'
          }`}>
            {count}
          </span>
        </div>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          !isExpanded ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
        }`}
      >
        <div className="pt-3 space-y-2.5 ml-4 pl-3 border-l border-border-subtle/50">
          {plans.map((plan) => (
            <PlanCard key={plan.plan_id} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
