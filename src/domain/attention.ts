import { z } from 'zod';

/**
 * Attention types that indicate what action a plan needs.
 * These are computed from plan state and related data.
 */
export const AttentionTypeSchema = z.enum([
  'awaiting_approval', // Draft with submitted_at set - waiting for reviewer
  'change_request', // Has pending ChangeRequest from orchestrator
  'gate_pending', // Published plan with execution blocked on human_approval gate
  'execution_failed', // Published plan with failed execution status
  'unread_comments', // Plan has unresolved comments on latest version
  'stale_draft', // Draft not updated in >threshold days
  'active', // Draft updated recently OR published with running execution
  'none', // No attention signals - plan is in a stable state
]);

export type AttentionType = z.infer<typeof AttentionTypeSchema>;

/**
 * Configuration for attention signal computation.
 */
export const AttentionConfigSchema = z.object({
  /** Days after which a draft is considered stale (default: 7) */
  stale_draft_threshold_days: z.number().int().positive().default(7),
  /** Hours within which a draft is considered active (default: 24) */
  active_threshold_hours: z.number().int().positive().default(24),
});

export type AttentionConfig = z.infer<typeof AttentionConfigSchema>;

/**
 * Default configuration for attention signals.
 */
export const DEFAULT_ATTENTION_CONFIG: AttentionConfig = {
  stale_draft_threshold_days: 7,
  active_threshold_hours: 24,
};

/**
 * Priority order for attention types (highest priority first).
 * Used to determine which signal to show when a plan has multiple.
 */
export const ATTENTION_PRIORITY: AttentionType[] = [
  'gate_pending',
  'execution_failed',
  'change_request',
  'awaiting_approval',
  'unread_comments',
  'active',
  'stale_draft',
  'none',
];
