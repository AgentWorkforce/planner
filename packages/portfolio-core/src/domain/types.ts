import { z } from 'zod';

/**
 * HealthScore - Computed health metrics (not persisted directly)
 */
export const HealthSignalsSchema = z.object({
  recency: z.number().min(0).max(100),
  velocity: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  attention: z.number().min(0).max(100),
  decision_density: z.number().min(0).max(100),
  external_pressure: z.number().min(0).max(100),
  execution_health: z.number().min(0).max(100),
});

export const HealthScoreSchema = z.object({
  entity_type: z.enum(['initiative', 'plan']),
  entity_id: z.string(),
  overall: z.number().min(0).max(100),
  signals: HealthSignalsSchema,
  staleness_days: z.number().int().min(0),
  computed_at: z.string().datetime(),
});

export type HealthSignals = z.infer<typeof HealthSignalsSchema>;
export type HealthScore = z.infer<typeof HealthScoreSchema>;

/**
 * HealthSnapshot - Persisted health score snapshot
 */
export const HealthSnapshotSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(['initiative', 'plan']),
  entity_id: z.string(),
  overall_score: z.number().int().min(0).max(100),
  signals: HealthSignalsSchema,
  staleness_days: z.number().int().min(0),
  computed_at: z.string().datetime(),
});

export type HealthSnapshot = z.infer<typeof HealthSnapshotSchema>;

/**
 * Suggestion - Computed suggestions for user action (not persisted)
 */
export const SuggestionSchema = z.object({
  type: z.enum(['plan', 'opportunity']),
  plan_id: z.string().nullable(),
  plan_goal: z.string(),
  initiative_id: z.string().nullable(),
  initiative_name: z.string().nullable(),
  score: z.number(),
  reasons: z.array(z.string()),
  project_id: z.string().nullable(),
  phase: z.enum(['ideating', 'planning', 'forging']).nullable(),
  cluster_id: z.string().nullable(),
  cluster_label: z.string().nullable(),
  signal_count: z.number().int().default(0),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

/**
 * PortfolioDecision - Persisted decision record
 */
export const PortfolioDecisionSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.enum(['initiative', 'plan', 'portfolio']),
  entity_id: z.string(),
  decision: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.string()).default([]),
  source: z.enum(['human', 'ai-suggested']),
  created_at: z.string().datetime(),
});

export type PortfolioDecision = z.infer<typeof PortfolioDecisionSchema>;

/**
 * CreateDecisionRequest - API validation schema
 */
export const CreateDecisionRequestSchema = z.object({
  entity_type: z.enum(['initiative', 'plan', 'portfolio']),
  entity_id: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  alternatives: z.array(z.string()).default([]),
  source: z.enum(['human', 'ai-suggested']),
});

export type CreateDecisionRequest = z.infer<typeof CreateDecisionRequestSchema>;

/**
 * PortfolioOverview - Computed portfolio summary (returned by /overview)
 */
export const PortfolioOverviewSchema = z.object({
  initiative_count: z.number().int(),
  active_plan_count: z.number().int(),
  health_summary: z.object({
    healthy: z.number().int(),
    warning: z.number().int(),
    critical: z.number().int(),
  }),
  top_suggestion: SuggestionSchema.nullable(),
  opportunity_count: z.number().int(),
});

export type PortfolioOverview = z.infer<typeof PortfolioOverviewSchema>;
