import { z } from 'zod';

// ============================================
// Step Complexity Level
// ============================================

/**
 * Maximum allowed complexity for steps in a plan.
 */
export const StepComplexityLevel = {
  /** Only atomic, trivial steps allowed */
  Atomic: 'atomic',
  /** Simple steps allowed (default) */
  Simple: 'simple',
  /** Compound steps with sub-plans allowed */
  Compound: 'compound',
} as const;

export type StepComplexityLevel = (typeof StepComplexityLevel)[keyof typeof StepComplexityLevel];

export const StepComplexityLevelSchema = z.enum(['atomic', 'simple', 'compound']);

// ============================================
// Decomposition Config
// ============================================

/**
 * Configuration for plan decomposition limits.
 * Research-backed defaults from METR 2025 and Six Sigma Agent research.
 *
 * Key findings:
 * - P(success) = (0.5)^(T/50min) - smaller steps = higher success
 * - 15-20 steps per scope is manageable for humans and agents
 * - 3 levels of depth prevents cognitive overload
 */
export const DecompositionConfigSchema = z.object({
  /** Maximum complexity level for individual steps */
  max_step_complexity: StepComplexityLevelSchema.default('simple'),

  /** Complexity score above which decomposition is recommended */
  auto_decompose_threshold: z.number().min(0).max(100).default(60),

  /** Maximum number of steps per scope (default: 15) */
  max_steps_per_scope: z.number().int().positive().default(15),

  /** Maximum depth of sub-plan nesting (default: 3) */
  max_depth: z.number().int().positive().default(3),

  /** Whether sub-plans are allowed (default: true) */
  allow_sub_plans: z.boolean().default(true),
});

export type DecompositionConfig = z.infer<typeof DecompositionConfigSchema>;

// ============================================
// Default Configuration
// ============================================

/**
 * Default decomposition config with research-backed values.
 *
 * Rationale:
 * - max_step_complexity: 'simple' - compound steps require explicit decomposition
 * - auto_decompose_threshold: 60 - borderline complexity triggers warning
 * - max_steps_per_scope: 15 - cognitive limit for human review
 * - max_depth: 3 - prevents deep nesting that's hard to reason about
 * - allow_sub_plans: true - enables hierarchical decomposition
 */
export const DEFAULT_DECOMPOSITION_CONFIG: DecompositionConfig =
  DecompositionConfigSchema.parse({});

// ============================================
// Factory Function
// ============================================

/**
 * Creates a decomposition config with custom values.
 */
export function createDecompositionConfig(options?: {
  maxStepComplexity?: StepComplexityLevel;
  autoDecomposeThreshold?: number;
  maxStepsPerScope?: number;
  maxDepth?: number;
  allowSubPlans?: boolean;
}): DecompositionConfig {
  return DecompositionConfigSchema.parse({
    max_step_complexity: options?.maxStepComplexity,
    auto_decompose_threshold: options?.autoDecomposeThreshold,
    max_steps_per_scope: options?.maxStepsPerScope,
    max_depth: options?.maxDepth,
    allow_sub_plans: options?.allowSubPlans,
  });
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Checks if a step count exceeds the limit for a scope.
 */
export function exceedsStepLimit(
  stepCount: number,
  config: DecompositionConfig = DEFAULT_DECOMPOSITION_CONFIG
): boolean {
  return stepCount > config.max_steps_per_scope;
}

/**
 * Checks if a depth exceeds the maximum allowed.
 */
export function exceedsDepthLimit(
  depth: number,
  config: DecompositionConfig = DEFAULT_DECOMPOSITION_CONFIG
): boolean {
  return depth > config.max_depth;
}

/**
 * Checks if a complexity score requires decomposition.
 */
export function requiresDecomposition(
  score: number,
  config: DecompositionConfig = DEFAULT_DECOMPOSITION_CONFIG
): boolean {
  return score >= config.auto_decompose_threshold;
}
