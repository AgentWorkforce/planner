/**
 * ModelSelector Service (Thompson Sampling)
 *
 * Learns optimal model selection using multi-armed bandit with Beta distributions.
 * Balances exploration (try different models) vs exploitation (use best known).
 */

import type { TaskOutcome } from '../domain/outcome.js';
import type { ModelBaseline, createModelBaseline } from '../domain/baseline.js';
import type { ForgeExecutionConfig, ModelSelectionRule } from '../domain/config.js';
import type { TunerStorage } from '../storage/interface.js';

/**
 * Model selection result with metadata.
 */
export interface ModelSelectionResult {
  model: string;
  reason: 'hard_rule' | 'exploration' | 'thompson_sampling' | 'round_robin' | 'default';
  ruleMatched?: ModelSelectionRule;
}

/**
 * Context for model selection.
 */
export interface ModelSelectionContext {
  taskType: string;
  complexity: string;
  languageTier?: string;
  onCriticalPath?: boolean;
}

/**
 * ModelSelector service.
 * Uses Thompson sampling to learn optimal model selection over time.
 */
export class ModelSelector {
  private static readonly MODELS = ['claude-haiku', 'claude-sonnet', 'claude-opus'] as const;

  constructor(
    private storage: TunerStorage,
    private config: ForgeExecutionConfig
  ) {}

  /**
   * Update the config (for periodic refresh).
   */
  updateConfig(config: ForgeExecutionConfig): void {
    this.config = config;
  }

  /**
   * Select a model for the given context.
   * Priority: hard rules > exploration > Thompson sampling
   */
  selectModel(context: ModelSelectionContext): ModelSelectionResult {
    // 1. Check hard rules first
    const hardRule = this.checkHardRules(context);
    if (hardRule) {
      return {
        model: hardRule.model,
        reason: 'hard_rule',
        ruleMatched: hardRule,
      };
    }

    // 2. Get total samples for burn-in check
    const totalSamples = this.storage.getTotalOutcomeCount();

    // 3. During burn-in, use round-robin to ensure all models get tried
    if (totalSamples < 50) {
      const model = ModelSelector.MODELS[totalSamples % ModelSelector.MODELS.length] ?? 'claude-sonnet';
      return { model, reason: 'round_robin' };
    }

    // 4. Exploration: random selection with probability = exploration_rate
    if (Math.random() < this.config.model_selection.exploration_rate) {
      const model = this.randomModel();
      return { model, reason: 'exploration' };
    }

    // 5. Exploitation: Thompson sampling
    const selected = this.thompsonSample(context);
    return { model: selected, reason: 'thompson_sampling' };
  }

  /**
   * Record an outcome to update the model's Beta distribution.
   */
  recordOutcome(outcome: TaskOutcome): void {
    const taskType = this.inferTaskType(outcome);
    const complexity = outcome.complexity_estimate || 'moderate';
    const model = outcome.model_used;
    const success = outcome.outcome === 'success';

    const existing = this.storage.getModelBaseline(model, taskType, complexity);

    if (!existing) {
      // Initialize with Beta(1,1) prior (uniform)
      const baseline: ModelBaseline = {
        model,
        task_type: taskType,
        complexity,
        alpha: success ? 2 : 1, // +1 for success
        beta: success ? 1 : 2,  // +1 for failure
        total_attempts: 1,
        success_rate: success ? 1 : 0,
        mean_cost_per_success: success ? outcome.cost_usd : 0,
        last_updated: new Date().toISOString(),
      };
      this.storage.upsertModelBaseline(baseline);
    } else {
      // Update Beta distribution: α++ on success, β++ on failure
      const newAttempts = existing.total_attempts + 1;
      const newSuccessRate = (existing.success_rate * existing.total_attempts + (success ? 1 : 0)) / newAttempts;

      const updated: ModelBaseline = {
        ...existing,
        alpha: existing.alpha + (success ? 1 : 0),
        beta: existing.beta + (success ? 0 : 1),
        total_attempts: newAttempts,
        success_rate: newSuccessRate,
        mean_cost_per_success: success
          ? (existing.mean_cost_per_success * existing.total_attempts + outcome.cost_usd) / newAttempts
          : existing.mean_cost_per_success,
        last_updated: new Date().toISOString(),
      };
      this.storage.upsertModelBaseline(updated);
    }
  }

  /**
   * Get model baselines (for CLI/debugging).
   */
  getModelBaselines(): ModelBaseline[] {
    return this.storage.listModelBaselines();
  }

  /**
   * Check hard rules from config.
   */
  private checkHardRules(context: ModelSelectionContext): ModelSelectionRule | null {
    for (const rule of this.config.model_selection.rules) {
      if (this.matchesCondition(rule.condition, context)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Check if context matches a rule condition.
   */
  private matchesCondition(
    condition: ModelSelectionRule['condition'],
    context: ModelSelectionContext
  ): boolean {
    if (condition.complexity && condition.complexity !== context.complexity) {
      return false;
    }
    if (condition.task_type && condition.task_type !== context.taskType) {
      return false;
    }
    if (condition.language_tier && condition.language_tier !== context.languageTier) {
      return false;
    }
    if (condition.on_critical_path !== undefined && condition.on_critical_path !== context.onCriticalPath) {
      return false;
    }
    return true;
  }

  /**
   * Random model selection for exploration.
   */
  private randomModel(): string {
    const index = Math.floor(Math.random() * ModelSelector.MODELS.length);
    return ModelSelector.MODELS[index] ?? 'claude-sonnet';
  }

  /**
   * Thompson sampling: sample from Beta distribution for each model, pick highest.
   */
  private thompsonSample(context: ModelSelectionContext): string {
    const samples: Array<{ model: string; sample: number }> = [];

    for (const model of ModelSelector.MODELS) {
      const baseline = this.storage.getModelBaseline(
        model,
        context.taskType,
        context.complexity
      );

      if (!baseline || baseline.total_attempts < 30) {
        // Not enough samples - use uninformative prior
        samples.push({ model, sample: this.sampleBeta(1, 1) });
      } else {
        samples.push({ model, sample: this.sampleBeta(baseline.alpha, baseline.beta) });
      }
    }

    // Sort by sampled value (descending) and return highest
    samples.sort((a, b) => b.sample - a.sample);
    return samples[0]?.model ?? 'claude-sonnet';
  }

  /**
   * Sample from Beta distribution using Gamma distribution trick.
   * Beta(α, β) = X / (X + Y) where X ~ Gamma(α, 1), Y ~ Gamma(β, 1)
   */
  private sampleBeta(alpha: number, beta: number): number {
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  /**
   * Sample from Gamma distribution using Marsaglia and Tsang's method.
   * For shape >= 1, this is efficient and accurate.
   */
  private sampleGamma(shape: number): number {
    if (shape < 1) {
      // For shape < 1, use: Gamma(a) = Gamma(a+1) * U^(1/a)
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x: number;
      let v: number;

      do {
        x = this.standardNormal();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  /**
   * Sample from standard normal distribution using Box-Muller transform.
   */
  private standardNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Infer task type from outcome (placeholder - should be enriched by Forge).
   */
  private inferTaskType(outcome: TaskOutcome): string {
    // This would ideally come from the task/step metadata
    // For now, use a simple heuristic based on step_id patterns
    const stepId = outcome.step_id.toLowerCase();

    if (stepId.includes('doc') || stepId.includes('readme')) return 'documentation';
    if (stepId.includes('arch') || stepId.includes('design')) return 'architecture';
    if (stepId.includes('test')) return 'test';
    if (stepId.includes('review') || stepId.includes('audit')) return 'review';
    if (stepId.includes('refactor')) return 'refactor';

    return 'implementation';
  }
}
