import type { AttentionType, PlanSummary } from '@/types';

/**
 * Priority order for attention types (highest priority first).
 * Used to determine which signal to show when a plan has multiple.
 */
const ATTENTION_PRIORITY: AttentionType[] = [
  'gate_pending',
  'execution_failed',
  'change_request',
  'awaiting_approval',
  'unread_comments',
  'active',
  'stale_draft',
  'none',
];

/**
 * Check if a plan has a specific attention type.
 */
export function hasAttention(plan: PlanSummary, type: AttentionType): boolean {
  return plan.attention_types?.includes(type) ?? false;
}

/**
 * Get the highest priority attention type for a plan.
 * Returns 'none' if plan has no attention types or only 'none'.
 */
export function getHighestPriorityAttention(plan: PlanSummary): AttentionType {
  if (!plan.attention_types || plan.attention_types.length === 0) {
    return 'none';
  }

  for (const type of ATTENTION_PRIORITY) {
    if (plan.attention_types.includes(type)) {
      return type;
    }
  }

  return 'none';
}

/**
 * Get a human-readable label for an attention type.
 */
export function getAttentionLabel(type: AttentionType): string {
  switch (type) {
    case 'awaiting_approval':
      return 'Awaiting Approval';
    case 'change_request':
      return 'Change Requested';
    case 'gate_pending':
      return 'Gate Pending';
    case 'execution_failed':
      return 'Execution Failed';
    case 'unread_comments':
      return 'Unread Comments';
    case 'stale_draft':
      return 'Stale Draft';
    case 'active':
      return 'Active';
    case 'none':
      return 'No Action Needed';
  }
}

/**
 * Get the design system color variable name for an attention type.
 */
export function getAttentionColor(type: AttentionType): string {
  switch (type) {
    case 'gate_pending':
      return 'warning';
    case 'execution_failed':
      return 'error';
    case 'change_request':
      return 'accent-purple';
    case 'awaiting_approval':
      return 'accent-cyan';
    case 'unread_comments':
      return 'accent-blue';
    case 'stale_draft':
      return 'text-muted';
    case 'active':
      return 'success';
    case 'none':
      return 'text-dim';
  }
}

/**
 * Check if a plan needs attention (has any attention type other than 'none' or 'active').
 */
export function needsAttention(plan: PlanSummary): boolean {
  if (!plan.attention_types) return false;

  return plan.attention_types.some(
    (type) => type !== 'none' && type !== 'active'
  );
}

/**
 * Get all attention types except 'none' for display purposes.
 */
export function getDisplayableAttentionTypes(plan: PlanSummary): AttentionType[] {
  if (!plan.attention_types) return [];

  return plan.attention_types.filter((type) => type !== 'none');
}
