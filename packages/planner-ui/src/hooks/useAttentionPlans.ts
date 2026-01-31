import { useMemo } from 'react';
import type { PlanSummary, AttentionType } from '@/types';

interface UseAttentionPlansResult {
  needsAttention: PlanSummary[];
  workingOn: PlanSummary[];
  allOther: PlanSummary[];
}

/**
 * Attention types that indicate a plan needs user attention.
 * Excludes 'none' and 'active' which don't require action.
 */
const URGENT_ATTENTION_TYPES: AttentionType[] = [
  'execution_failed',
  'change_request',
  'gate_pending',
  'awaiting_approval',
  'stale_draft',
  'unread_comments',
];

/**
 * Check if a plan has any urgent attention types.
 */
function hasUrgentAttention(plan: PlanSummary): boolean {
  if (!plan.attention_types || plan.attention_types.length === 0) {
    return false;
  }
  return plan.attention_types.some((type) => URGENT_ATTENTION_TYPES.includes(type));
}

/**
 * Check if a plan is being actively worked on.
 */
function isWorkingOn(plan: PlanSummary): boolean {
  if (!plan.attention_types) return false;
  return plan.attention_types.includes('active');
}

/**
 * Hook to categorize plans into attention-based sections.
 *
 * Categorization rules:
 * - needsAttention: Plans with urgent attention types (not 'none', not only 'active')
 * - workingOn: Plans with 'active' attention type
 * - allOther: All plans (for the "All Plans" section)
 *
 * Note: A plan can appear in multiple categories (e.g., both needsAttention and workingOn).
 */
export function useAttentionPlans(plans: PlanSummary[]): UseAttentionPlansResult {
  return useMemo(() => {
    const needsAttention: PlanSummary[] = [];
    const workingOn: PlanSummary[] = [];

    for (const plan of plans) {
      if (hasUrgentAttention(plan)) {
        needsAttention.push(plan);
      }
      if (isWorkingOn(plan)) {
        workingOn.push(plan);
      }
    }

    return {
      needsAttention,
      workingOn,
      allOther: plans, // All plans for the "All Plans" section
    };
  }, [plans]);
}
