import type { PlanSummary, AttentionType } from '@/types';
import { CollapsibleSection } from './CollapsibleSection';
import { AttentionItem } from './AttentionItem';
import { AttentionBadge } from './AttentionBadge';
import { CheckIcon } from '@/components/icons';
import { getHighestPriorityAttention } from '@/utils/attention';
import { formatAttentionTime } from '@/utils/time';

interface NeedsAttentionSectionProps {
  plans: PlanSummary[];
}

/**
 * Urgency order for attention types.
 * Higher index = lower priority.
 */
const URGENCY_ORDER: AttentionType[] = [
  'execution_failed',
  'change_request',
  'gate_pending',
  'awaiting_approval',
  'stale_draft',
  'unread_comments',
];

/**
 * Get the accent color for the section header based on highest urgency item.
 */
function getSectionAccentColor(
  highestUrgency: AttentionType
): 'error' | 'warning' | 'cyan' | 'muted' {
  switch (highestUrgency) {
    case 'execution_failed':
      return 'error';
    case 'change_request':
    case 'gate_pending':
    case 'awaiting_approval':
      return 'warning';
    case 'stale_draft':
    case 'unread_comments':
      return 'muted';
    default:
      return 'muted';
  }
}

interface GroupedPlans {
  type: AttentionType;
  plans: PlanSummary[];
}

/**
 * Group and sort plans by attention type.
 */
function groupAndSortPlans(plans: PlanSummary[]): GroupedPlans[] {
  // Group by primary attention type
  const groups = new Map<AttentionType, PlanSummary[]>();

  for (const plan of plans) {
    const primaryType = getHighestPriorityAttention(plan);
    // Skip plans with 'none' or 'active' as primary type
    if (primaryType === 'none' || primaryType === 'active') {
      continue;
    }

    if (!groups.has(primaryType)) {
      groups.set(primaryType, []);
    }
    groups.get(primaryType)!.push(plan);
  }

  // Sort plans within each group by updated_at descending
  for (const [, groupPlans] of groups) {
    groupPlans.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  // Sort groups by urgency order
  const result: GroupedPlans[] = [];
  for (const type of URGENCY_ORDER) {
    const groupPlans = groups.get(type);
    if (groupPlans && groupPlans.length > 0) {
      result.push({ type, plans: groupPlans });
    }
  }

  return result;
}

/**
 * Section displaying plans that need user attention, grouped by type.
 *
 * Groups are sorted by urgency:
 * 1. execution_failed (most urgent)
 * 2. change_request
 * 3. gate_pending
 * 4. awaiting_approval
 * 5. stale_draft
 * 6. unread_comments (least urgent)
 *
 * Empty state shows "All caught up!" with success accent.
 */
export function NeedsAttentionSection({ plans }: NeedsAttentionSectionProps) {
  const groupedPlans = groupAndSortPlans(plans);
  const totalCount = groupedPlans.reduce((sum, group) => sum + group.plans.length, 0);

  // Determine highest urgency for section accent
  const highestUrgency = groupedPlans.length > 0 ? groupedPlans[0].type : 'none';
  const accentColor = groupedPlans.length > 0 ? getSectionAccentColor(highestUrgency) : 'green';

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-14 h-14 mb-4 rounded-full bg-success/10 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,200,0.15)]">
        <CheckIcon size="lg" className="text-success" />
      </div>
      <p className="text-text-primary font-medium text-base">All caught up!</p>
      <p className="text-sm text-text-muted mt-1.5">No plans need your attention right now.</p>
    </div>
  );

  return (
    <CollapsibleSection
      sectionId="needs-attention"
      title="Needs Attention"
      count={totalCount}
      accentColor={accentColor}
      emptyState={emptyState}
    >
      {groupedPlans.length > 0 && (
        <div className="space-y-5">
          {groupedPlans.map(({ type, plans: groupPlans }) => (
            <div key={type}>
              {/* Group header */}
              <div className="flex items-center gap-2.5 mb-3 pl-1">
                <AttentionBadge type={type} variant="full" />
                <span className="text-xs text-text-dim font-medium">
                  {groupPlans.length} {groupPlans.length === 1 ? 'plan' : 'plans'}
                </span>
              </div>

              {/* Group items */}
              <div className="space-y-2.5">
                {groupPlans.map((plan) => (
                  <AttentionItem
                    key={plan.plan_id}
                    plan={plan}
                    timeContext={formatAttentionTime(plan.updated_at, type)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
