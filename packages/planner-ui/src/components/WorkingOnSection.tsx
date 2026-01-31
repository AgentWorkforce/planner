import type { PlanSummary } from '@/types';
import { CollapsibleSection } from './CollapsibleSection';
import { AttentionItem } from './AttentionItem';
import { formatRelativeTime } from '@/utils/time';

interface WorkingOnSectionProps {
  plans: PlanSummary[];
}

/**
 * Get the time context string for an active plan.
 * Returns "Running" if execution is active, otherwise "Last edited X ago".
 */
function getActiveTimeContext(plan: PlanSummary): string {
  // Check if plan has execution_failed or similar indicating it was/is running
  // For now, we'll show "Last edited X ago" for all active plans
  const relative = formatRelativeTime(plan.updated_at);
  return relative ? `Last edited ${relative}` : 'Recently edited';
}

/**
 * Sort plans by updated_at descending (most recently touched first).
 */
function sortByUpdatedAt(plans: PlanSummary[]): PlanSummary[] {
  return [...plans].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/**
 * Section displaying plans the user is actively working on.
 *
 * Shows drafts updated recently and running executions.
 * Hidden entirely when no active plans (hideWhenEmpty=true).
 * Sorted by updated_at descending.
 */
export function WorkingOnSection({ plans }: WorkingOnSectionProps) {
  const sortedPlans = sortByUpdatedAt(plans);

  return (
    <CollapsibleSection
      sectionId="working-on"
      title="Working On"
      count={sortedPlans.length}
      accentColor="cyan"
      hideWhenEmpty
    >
      {sortedPlans.length > 0 && (
        <div className="space-y-2">
          {sortedPlans.map((plan) => (
            <AttentionItem
              key={plan.plan_id}
              plan={plan}
              timeContext={getActiveTimeContext(plan)}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
