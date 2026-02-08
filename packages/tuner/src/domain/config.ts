/**
 * Configuration types for Tuner.
 * These are the outputs that Forge and Planner read.
 */

import { z } from 'zod';

// ============================================================================
// Model Selection Types
// ============================================================================

export const ModelSelectionConditionSchema = z.object({
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex', 'very_complex']).optional(),
  task_type: z.enum(['documentation', 'architecture', 'implementation', 'review', 'test', 'refactor']).optional(),
  language_tier: z.enum(['S', 'A', 'B', 'C', 'D']).optional(),
  on_critical_path: z.boolean().optional(),
});

export type ModelSelectionCondition = z.infer<typeof ModelSelectionConditionSchema>;

export const ModelSelectionRuleSchema = z.object({
  condition: ModelSelectionConditionSchema,
  model: z.enum(['claude-haiku', 'claude-sonnet', 'claude-opus']),
});

export type ModelSelectionRule = z.infer<typeof ModelSelectionRuleSchema>;

// ============================================================================
// ForgeExecutionConfig
// ============================================================================

export const ForgeExecutionConfigSchema = z.object({
  model_selection: z.object({
    default_model: z.enum(['claude-haiku', 'claude-sonnet', 'claude-opus']),
    exploration_rate: z.number().min(0).max(1),
    rules: z.array(ModelSelectionRuleSchema),
  }),

  budgets: z.object({
    per_task_time_seconds: z.number().positive(),
    per_task_token_limit: z.number().positive().int(),
    per_run_cost_limit_usd: z.number().positive(),
  }),

  retry: z.object({
    max_retries_per_task: z.number().int().min(0),
    backoff: z.enum(['linear', 'exponential']),
    backoff_base_seconds: z.number().positive(),
    include_failure_analysis: z.boolean(),
  }),

  parallelism: z.object({
    max_concurrent_tasks: z.number().int().positive(),
    prefer_sequential_in_scope: z.boolean(),
  }),

  confidence: z.object({
    escalation_threshold: z.number().min(0).max(1),
    review_threshold: z.number().min(0).max(1),
  }),

  language_time_multipliers: z.object({
    tier_s: z.number().positive(),
    tier_a: z.number().positive(),
    tier_b: z.number().positive(),
    tier_c: z.number().positive(),
    tier_d: z.number().positive(),
  }),

  version: z.number().int().positive(),
  updated_at: z.string().datetime(),
});

export type ForgeExecutionConfig = z.infer<typeof ForgeExecutionConfigSchema>;

// ============================================================================
// PlannerConfig
// ============================================================================

export const PlannerConfigSchema = z.object({
  complexity_weights: z.object({
    description_tokens: z.number(),
    scope_count: z.number(),
    dependency_count: z.number(),
    ac_count: z.number(),
    keyword_boost: z.number(),
  }),

  language_complexity_multipliers: z.object({
    tier_s: z.number().positive(),
    tier_a: z.number().positive(),
    tier_b: z.number().positive(),
    tier_c: z.number().positive(),
    tier_d: z.number().positive(),
  }),

  decomposition: z.object({
    max_step_complexity: z.enum(['atomic', 'simple', 'compound']),
    auto_decompose_threshold_tokens: z.number().int().positive(),
    max_steps_per_plan: z.number().int().positive(),
    max_depth: z.number().int().positive(),
  }),

  version: z.number().int().positive(),
  updated_at: z.string().datetime(),
});

export type PlannerConfig = z.infer<typeof PlannerConfigSchema>;

// ============================================================================
// Default Configurations (research-backed)
// ============================================================================

export const DEFAULT_FORGE_CONFIG: ForgeExecutionConfig = {
  model_selection: {
    default_model: 'claude-sonnet',
    exploration_rate: 0.10,
    rules: [
      { condition: { complexity: 'trivial' }, model: 'claude-haiku' },
      { condition: { complexity: 'very_complex', on_critical_path: true }, model: 'claude-opus' },
      { condition: { task_type: 'documentation' }, model: 'claude-haiku' },
      { condition: { task_type: 'architecture' }, model: 'claude-opus' },
      { condition: { language_tier: 'D' }, model: 'claude-opus' },
      { condition: { language_tier: 'C' }, model: 'claude-opus' },
    ],
  },
  budgets: {
    per_task_time_seconds: 300,
    per_task_token_limit: 50000,
    per_run_cost_limit_usd: 10.0,
  },
  retry: {
    max_retries_per_task: 3,
    backoff: 'exponential',
    backoff_base_seconds: 30,
    include_failure_analysis: true,
  },
  parallelism: {
    max_concurrent_tasks: 5,
    prefer_sequential_in_scope: false,
  },
  confidence: {
    escalation_threshold: 0.5,
    review_threshold: 0.7,
  },
  language_time_multipliers: {
    tier_s: 2.5,
    tier_a: 3.5,
    tier_b: 5.0,
    tier_c: 8.0,
    tier_d: 15.0,
  },
  version: 1,
  updated_at: new Date().toISOString(),
};

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  complexity_weights: {
    description_tokens: 0.01,
    scope_count: 0.5,
    dependency_count: 0.3,
    ac_count: 0.2,
    keyword_boost: 0.1,
  },
  language_complexity_multipliers: {
    tier_s: 1.0,
    tier_a: 1.2,
    tier_b: 1.5,
    tier_c: 2.0,
    tier_d: 3.0,
  },
  decomposition: {
    max_step_complexity: 'simple',
    auto_decompose_threshold_tokens: 10000,
    max_steps_per_plan: 50,
    max_depth: 3,
  },
  version: 1,
  updated_at: new Date().toISOString(),
};

// ============================================================================
// IdeationConfig
// ============================================================================

export const IdeationConfigSchema = z.object({
  interviewer: z.object({
    model: z.string().default('claude-sonnet-4-20250514'),
    max_tokens: z.number().int().default(4096),
    temperature: z.number().min(0).max(1).default(0.7),
  }),
  specialist_spawning: z.object({
    early_spawn_keywords: z.array(z.string()).default([]),
    min_confidence_to_spawn: z.number().min(0).max(100).default(60),
    max_specialists: z.number().int().default(5),
    deprioritized_specialists: z.array(z.string()).default([]),
  }),
  confidence_calibration: z.object({
    uncertain_below: z.number().min(0).max(100).default(40),
    confident_above: z.number().min(0).max(100).default(80),
  }),
  readiness_advisory: z.object({
    min_conversation_turns: z.number().int().default(3),
    min_specialist_coverage: z.number().min(0).max(1).default(0.5),
    block_threshold: z.number().int().default(2),
  }),
  version: z.number().int(),
  updated_at: z.string().datetime(),
});

export type IdeationConfig = z.infer<typeof IdeationConfigSchema>;

export const DEFAULT_IDEATION_CONFIG: IdeationConfig = {
  interviewer: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.7,
  },
  specialist_spawning: {
    early_spawn_keywords: [],
    min_confidence_to_spawn: 60,
    max_specialists: 5,
    deprioritized_specialists: [],
  },
  confidence_calibration: {
    uncertain_below: 40,
    confident_above: 80,
  },
  readiness_advisory: {
    min_conversation_turns: 3,
    min_specialist_coverage: 0.5,
    block_threshold: 2,
  },
  version: 0,
  updated_at: new Date().toISOString(),
};
