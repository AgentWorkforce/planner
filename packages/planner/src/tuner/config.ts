import { z } from 'zod';
import { TIER_MULTIPLIERS } from '../domain/language-tier.js';

// ============================================
// Complexity Weights
// ============================================

/**
 * Weights for the complexity estimation formula.
 * Research-backed defaults from METR 2025 and agentic research.
 *
 * Formula: score = (descTokens/500)*description_weight + scopeCount*scope_weight
 *                  + depCount*dependency_weight + acCount*ac_weight + keywordBoost*keyword_weight
 */
export const ComplexityWeightsSchema = z.object({
  /** Weight for description token count (default: 30) */
  description_weight: z.number().min(0).default(30),

  /** Weight for scope count (default: 10) */
  scope_weight: z.number().min(0).default(10),

  /** Weight for dependency count (default: 5) */
  dependency_weight: z.number().min(0).default(5),

  /** Weight for acceptance criteria count (default: 3) */
  ac_weight: z.number().min(0).default(3),

  /** Weight for keyword boost (default: 5) */
  keyword_weight: z.number().min(0).default(5),
});

export type ComplexityWeights = z.infer<typeof ComplexityWeightsSchema>;

// ============================================
// Language Complexity Multipliers
// ============================================

/**
 * Multipliers for language tier complexity adjustment.
 * Maps tier names to multiplier values.
 */
export const LanguageComplexityMultipliersSchema = z.object({
  s: z.number().positive().default(1.0),
  a: z.number().positive().default(1.4),
  b: z.number().positive().default(2.0),
  c: z.number().positive().default(3.2),
  d: z.number().positive().default(5.0),
});

export type LanguageComplexityMultipliers = z.infer<typeof LanguageComplexityMultipliersSchema>;

// ============================================
// Decomposition Settings
// ============================================

/**
 * Settings for plan decomposition limits.
 * Can override defaults from DecompositionConfig.
 */
export const DecompositionSettingsSchema = z.object({
  /** Maximum steps per scope (default: 15) */
  max_steps_per_scope: z.number().int().positive().default(15),

  /** Maximum sub-plan depth (default: 3) */
  max_depth: z.number().int().positive().default(3),

  /** Complexity score threshold for automatic decomposition warning (default: 60) */
  auto_decompose_threshold: z.number().min(0).max(100).default(60),

  /** Complexity score threshold requiring decomposition (default: 75) */
  require_decomposition_threshold: z.number().min(0).max(100).default(75),
});

export type DecompositionSettings = z.infer<typeof DecompositionSettingsSchema>;

// ============================================
// LLM Adjustment Settings
// ============================================

/**
 * Settings for optional LLM-based complexity adjustment.
 */
export const LLMadjustmentSettingsSchema = z.object({
  /** Enable LLM adjustment for borderline scores (default: false) */
  enabled: z.boolean().default(false),

  /** Lower bound for borderline scores (default: 30) */
  borderline_min: z.number().min(0).max(100).default(30),

  /** Upper bound for borderline scores (default: 60) */
  borderline_max: z.number().min(0).max(100).default(60),

  /** Maximum adjustment percentage (default: 0.2 = 20%) */
  max_adjustment_percent: z.number().min(0).max(1).default(0.2),
});

export type LLMadjustmentSettings = z.infer<typeof LLMadjustmentSettingsSchema>;

// ============================================
// Planner Config
// ============================================

/**
 * Configuration for the Planner, fetched from Tuner.
 * All settings have research-backed defaults.
 */
export const PlannerConfigSchema = z.object({
  /** Weights for complexity estimation formula */
  complexity_weights: ComplexityWeightsSchema.default({}),

  /** Multipliers for language tier complexity */
  language_complexity_multipliers: LanguageComplexityMultipliersSchema.default({}),

  /** Decomposition limits and thresholds */
  decomposition: DecompositionSettingsSchema.default({}),

  /** LLM adjustment settings (optional, disabled by default) */
  llm_adjustment: LLMadjustmentSettingsSchema.default({}),

  /** Config version for cache invalidation */
  version: z.string().optional(),

  /** Timestamp when config was last updated */
  updated_at: z.string().datetime().optional(),
});

export type PlannerConfig = z.infer<typeof PlannerConfigSchema>;

// ============================================
// Default Configuration
// ============================================

/**
 * Default Planner config with research-backed values.
 *
 * Research basis:
 * - METR 2025: P(success) = (0.5)^(T/50min) - decomposition is critical
 * - MultiPL-E: Language tiers create 68-point accuracy gaps
 * - Six Sigma Agent: Atomic steps with voting = 43x reliability
 */
export const DEFAULT_PLANNER_CONFIG: PlannerConfig = PlannerConfigSchema.parse({
  complexity_weights: {
    description_weight: 30,
    scope_weight: 10,
    dependency_weight: 5,
    ac_weight: 3,
    keyword_weight: 5,
  },
  language_complexity_multipliers: TIER_MULTIPLIERS,
  decomposition: {
    max_steps_per_scope: 15,
    max_depth: 3,
    auto_decompose_threshold: 60,
    require_decomposition_threshold: 75,
  },
  llm_adjustment: {
    enabled: false,
    borderline_min: 30,
    borderline_max: 60,
    max_adjustment_percent: 0.2,
  },
});

// ============================================
// Helper Functions
// ============================================

/**
 * Merges partial config with defaults.
 */
export function mergeWithDefaults(partial?: Partial<PlannerConfig>): PlannerConfig {
  if (!partial) return DEFAULT_PLANNER_CONFIG;
  return PlannerConfigSchema.parse(partial);
}

/**
 * Validates a config object against the schema.
 */
export function validateConfig(config: unknown): PlannerConfig {
  return PlannerConfigSchema.parse(config);
}
