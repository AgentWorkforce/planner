/**
 * ModelSelector - DOT Framework Model Routing
 *
 * Selects the appropriate model (haiku, sonnet, opus) based on task complexity.
 * Research basis: SWE-bench - Opus 80.9%, Sonnet 64.8%, Haiku 60.6%
 *
 * Features:
 * - Complexity-based model selection
 * - Configurable routing rules from Tuner
 * - Cost optimization (Haiku 3.7x cost efficient per success)
 * - Trajectory logging for learning
 */

import type { Task } from '../domain/types.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import {
  type ModelType,
  type ModelRoutingRule,
  DEFAULT_MODEL_ROUTING_RULES,
} from '../config/forge-config.js';

// ============================================
// Types
// ============================================

/**
 * Context for model selection
 */
export interface ModelSelectionContext {
  /** The task to select a model for */
  task: Task;
  /** Run ID for trajectory events */
  runId: string;
  /** Complexity score (0-1, optional) */
  complexityScore?: number;
  /** Language tier (S, A, B, C, D) */
  languageTier?: string;
  /** Step role/type (e.g., "architecture", "implementation") */
  stepRole?: string;
}

/**
 * Result of model selection
 */
export interface ModelSelectionResult {
  /** Selected model */
  model: ModelType;
  /** Reason for selection */
  reason: string;
  /** Rule that matched (if any) */
  matchedRule?: ModelRoutingRule;
  /** Complexity category used */
  complexityCategory?: string;
}

// ============================================
// Complexity Categories
// ============================================

/**
 * Maps complexity score to category
 */
function getComplexityCategory(score?: number): string {
  if (score === undefined) return 'default';
  if (score <= 0.2) return 'trivial';
  if (score <= 0.4) return 'simple';
  if (score <= 0.6) return 'moderate';
  if (score <= 0.8) return 'complex';
  return 'architecture';
}

/**
 * Checks if a task role suggests architecture work
 */
function isArchitectureRole(role?: string): boolean {
  if (!role) return false;
  const lowerRole = role.toLowerCase();
  return (
    lowerRole.includes('architect') ||
    lowerRole.includes('design') ||
    lowerRole.includes('system')
  );
}

// ============================================
// ModelSelector
// ============================================

/**
 * ModelSelector chooses the appropriate model for task execution.
 *
 * Selection priority:
 * 1. Architecture-related tasks -> Opus
 * 2. Complexity score-based rules
 * 3. Default rule
 *
 * This enables cost optimization while maintaining quality for complex tasks.
 */
export class ModelSelector {
  private rules: ModelRoutingRule[];
  private trajectoryCapture: TrajectoryCapture | null;
  private defaultModel: ModelType;

  constructor(options?: {
    /** Custom routing rules */
    rules?: ModelRoutingRule[];
    /** Trajectory capture for logging */
    trajectoryCapture?: TrajectoryCapture;
    /** Default model when no rule matches */
    defaultModel?: ModelType;
  }) {
    this.rules = options?.rules ?? DEFAULT_MODEL_ROUTING_RULES;
    this.trajectoryCapture = options?.trajectoryCapture ?? null;
    this.defaultModel = options?.defaultModel ?? 'sonnet';
  }

  /**
   * Selects the appropriate model for a task.
   *
   * @param context - Context including task and complexity info
   * @returns Selected model with reason
   */
  selectModelForTask(context: ModelSelectionContext): ModelSelectionResult {
    const { task, runId, complexityScore, languageTier, stepRole } = context;

    // Check for explicit model override (user-specified per-step)
    if (task.model_override) {
      const result: ModelSelectionResult = {
        model: task.model_override as ModelType,
        reason: 'User-specified model override',
        complexityCategory: 'override',
      };
      this.logSelection(runId, task.task_id, result);
      return result;
    }

    // Check for architecture role first
    if (isArchitectureRole(stepRole) || isArchitectureRole(task.step_title)) {
      const result: ModelSelectionResult = {
        model: 'opus',
        reason: 'Architecture-related task detected',
        complexityCategory: 'architecture',
      };
      this.logSelection(runId, task.task_id, result);
      return result;
    }

    // Get complexity category
    const category = getComplexityCategory(complexityScore);

    // Find matching rule
    const matchedRule = this.findMatchingRule(category, complexityScore);

    if (matchedRule) {
      const result: ModelSelectionResult = {
        model: matchedRule.model,
        reason: `Matched rule for ${matchedRule.condition}`,
        matchedRule,
        complexityCategory: category,
      };
      this.logSelection(runId, task.task_id, result);
      return result;
    }

    // Fallback to default
    const result: ModelSelectionResult = {
      model: this.defaultModel,
      reason: 'No matching rule, using default',
      complexityCategory: category,
    };
    this.logSelection(runId, task.task_id, result);
    return result;
  }

  /**
   * Finds the matching rule for a complexity category.
   */
  private findMatchingRule(
    category: string,
    complexityScore?: number
  ): ModelRoutingRule | undefined {
    // First try to find exact category match
    const exactMatch = this.rules.find(r => r.condition === category);
    if (exactMatch) return exactMatch;

    // Try to find threshold-based match
    if (complexityScore !== undefined) {
      const thresholdMatch = this.rules
        .filter(r => r.complexity_threshold !== undefined)
        .sort((a, b) => (b.complexity_threshold ?? 0) - (a.complexity_threshold ?? 0))
        .find(r => complexityScore >= (r.complexity_threshold ?? 0));
      if (thresholdMatch) return thresholdMatch;
    }

    // Find default rule
    return this.rules.find(r => r.condition === 'default');
  }

  /**
   * Logs model selection to trajectory.
   */
  private logSelection(
    runId: string,
    taskId: string,
    result: ModelSelectionResult
  ): void {
    if (!this.trajectoryCapture) return;

    this.trajectoryCapture.capture(
      runId,
      'model_selected' as any,
      {
        task_id: taskId,
        model: result.model,
        reason: result.reason,
        complexity_category: result.complexityCategory,
        matched_rule: result.matchedRule
          ? {
              condition: result.matchedRule.condition,
              threshold: result.matchedRule.complexity_threshold,
            }
          : undefined,
      },
      taskId
    );
  }

  /**
   * Updates the routing rules.
   * Useful when Tuner provides optimized rules.
   *
   * @param rules - New routing rules
   */
  updateRules(rules: ModelRoutingRule[]): void {
    this.rules = rules;
  }

  /**
   * Gets the current routing rules.
   */
  getRules(): ModelRoutingRule[] {
    return [...this.rules];
  }

  /**
   * Sets the default model.
   *
   * @param model - Default model to use
   */
  setDefaultModel(model: ModelType): void {
    this.defaultModel = model;
  }

  /**
   * Gets the default model.
   */
  getDefaultModel(): ModelType {
    return this.defaultModel;
  }

  /**
   * Estimates cost multiplier based on model.
   * Research: Haiku is ~3.7x cheaper than Sonnet, Opus is ~4x more expensive
   */
  static getCostMultiplier(model: ModelType): number {
    switch (model) {
      case 'haiku':
        return 0.27; // ~3.7x cheaper than sonnet
      case 'sonnet':
        return 1.0; // baseline
      case 'opus':
        return 4.0; // ~4x more expensive
      default:
        return 1.0;
    }
  }

  /**
   * Estimates success rate based on model and complexity.
   * Research: SWE-bench success rates
   */
  static getExpectedSuccessRate(model: ModelType, complexity?: number): number {
    const baseRates: Record<ModelType, number> = {
      haiku: 0.606,
      sonnet: 0.648,
      opus: 0.809,
    };

    const base = baseRates[model] ?? 0.65;

    // Adjust for complexity
    if (complexity !== undefined) {
      // Higher complexity reduces success rate
      const adjustment = 1 - (complexity * 0.3);
      return base * adjustment;
    }

    return base;
  }
}

/**
 * Factory function to create ModelSelector.
 */
export function createModelSelector(options?: {
  rules?: ModelRoutingRule[];
  trajectoryCapture?: TrajectoryCapture;
  defaultModel?: ModelType;
}): ModelSelector {
  return new ModelSelector(options);
}
