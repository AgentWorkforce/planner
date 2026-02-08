import type { Step } from '../../domain/step.js';
import type { PlanVersion } from '../../domain/plan.js';
import type { PlannerConfig } from '../../tuner/config.js';
import { DEFAULT_PLANNER_CONFIG, getDefaultTunerClient } from '../../tuner/index.js';
import {
  estimateComplexity,
  detectLanguageTier,
} from '../../services/index.js';

// ============================================
// Types
// ============================================

export interface EnrichmentOptions {
  /** Skip language tier detection (use existing values only) */
  skipLanguageDetection?: boolean;
  /** Skip complexity estimation (use existing values only) */
  skipComplexityEstimation?: boolean;
  /** Force re-enrichment even if values exist */
  forceReenrich?: boolean;
  /** Config to use (fetches from TunerClient if not provided) */
  config?: PlannerConfig;
}

export interface EnrichmentResult {
  steps: Step[];
  enrichedCount: number;
  skippedCount: number;
}

// ============================================
// Step Enrichment
// ============================================

/**
 * Enriches a single step with language tier and complexity estimate.
 *
 * Behavior:
 * - If step already has language_tier/complexity_estimate, preserves them (unless forceReenrich)
 * - Language tier is detected first (used in complexity calculation)
 * - Complexity estimate is calculated using detected tier
 */
export function enrichStep(
  step: Step,
  options: EnrichmentOptions = {}
): Step {
  const config = options.config ?? getConfig();

  // Create a copy to avoid mutation
  let enrichedStep = { ...step };
  let wasEnriched = false;

  // Enrich language tier first (used in complexity calculation)
  if (!options.skipLanguageDetection) {
    if (options.forceReenrich || !enrichedStep.language_tier) {
      enrichedStep.language_tier = detectLanguageTier(step);
      wasEnriched = true;
    }
  }

  // Enrich complexity estimate (uses language tier)
  if (!options.skipComplexityEstimation) {
    if (options.forceReenrich || !enrichedStep.complexity_estimate) {
      enrichedStep.complexity_estimate = estimateComplexity(enrichedStep, {
        config,
        languageTier: enrichedStep.language_tier,
      });
      wasEnriched = true;
    }
  }

  return enrichedStep;
}

/**
 * Enriches multiple steps with language tier and complexity estimate.
 *
 * Returns detailed result including counts of enriched/skipped steps.
 */
export function enrichSteps(
  steps: Step[],
  options: EnrichmentOptions = {}
): EnrichmentResult {
  const config = options.config ?? getConfig();
  const optionsWithConfig = { ...options, config };

  const enrichedSteps: Step[] = [];
  let enrichedCount = 0;
  let skippedCount = 0;

  for (const step of steps) {
    const needsEnrichment = shouldEnrichStep(step, options);

    if (needsEnrichment) {
      enrichedSteps.push(enrichStep(step, optionsWithConfig));
      enrichedCount++;
    } else {
      enrichedSteps.push(step);
      skippedCount++;
    }
  }

  return {
    steps: enrichedSteps,
    enrichedCount,
    skippedCount,
  };
}

/**
 * Determines if a step needs enrichment.
 */
function shouldEnrichStep(step: Step, options: EnrichmentOptions): boolean {
  if (options.forceReenrich) return true;

  const needsLanguageTier = !options.skipLanguageDetection && !step.language_tier;
  const needsComplexity = !options.skipComplexityEstimation && !step.complexity_estimate;

  return needsLanguageTier || needsComplexity;
}

// ============================================
// Plan Version Enrichment
// ============================================

/**
 * Enriches a plan version's steps with DOT metadata.
 *
 * Returns a new PlanVersion with enriched steps.
 */
export function enrichPlanVersion(
  planVersion: PlanVersion,
  options: EnrichmentOptions = {}
): PlanVersion {
  const result = enrichSteps(planVersion.steps, options);

  return {
    ...planVersion,
    steps: result.steps,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Enriches a plan version for creation (all steps get enriched).
 */
export function enrichPlanVersionForCreate(
  planVersion: PlanVersion,
  options: EnrichmentOptions = {}
): PlanVersion {
  // For create, always enrich all steps
  return enrichPlanVersion(planVersion, {
    ...options,
    forceReenrich: false, // Don't override manually specified values
  });
}

/**
 * Enriches a plan version for update (only new/modified steps get enriched).
 *
 * @param planVersion - The updated plan version
 * @param originalSteps - Original steps (to detect changes)
 */
export function enrichPlanVersionForUpdate(
  planVersion: PlanVersion,
  originalSteps: Step[],
  options: EnrichmentOptions = {}
): PlanVersion {
  const originalStepIds = new Set(originalSteps.map((s) => s.step_id));
  const config = options.config ?? getConfig();

  const enrichedSteps = planVersion.steps.map((step) => {
    // New steps always get enriched
    if (!originalStepIds.has(step.step_id)) {
      return enrichStep(step, { ...options, config });
    }

    // Existing steps only enriched if missing DOT fields
    if (shouldEnrichStep(step, options)) {
      return enrichStep(step, { ...options, config });
    }

    return step;
  });

  return {
    ...planVersion,
    steps: enrichedSteps,
    updated_at: new Date().toISOString(),
  };
}

// ============================================
// Express Middleware (optional integration)
// ============================================

/**
 * Express middleware factory for automatic plan enrichment.
 *
 * Usage:
 * ```
 * app.use('/api/plans', dotEnrichmentMiddleware());
 * ```
 */
export function createEnrichmentMiddleware(options: EnrichmentOptions = {}) {
  return (req: any, res: any, next: any) => {
    // Store enrichment options in request for later use
    req.dotEnrichmentOptions = options;
    next();
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Gets the current Planner config from TunerClient.
 */
function getConfig(): PlannerConfig {
  try {
    return getDefaultTunerClient().getConfig();
  } catch {
    // Fallback to defaults if TunerClient not initialized
    return DEFAULT_PLANNER_CONFIG;
  }
}

/**
 * Logs enrichment activity (for debugging).
 */
export function logEnrichmentResult(
  result: EnrichmentResult,
  context: string = 'enrichment'
): void {
  console.log(
    `[DOT ${context}] Enriched ${result.enrichedCount} steps, skipped ${result.skippedCount}`
  );
}
