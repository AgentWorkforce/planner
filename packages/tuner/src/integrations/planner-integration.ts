/**
 * Planner Integration Example
 *
 * Demonstrates how Planner can integrate with Tuner for:
 * - Reading complexity weights and estimation config
 * - Getting language tier multipliers for task estimation
 *
 * Usage in Planner:
 * ```typescript
 * import { PlannerIntegration } from 'tuner/integrations/planner-integration';
 *
 * const tuner = new PlannerIntegration();
 * await tuner.initialize();
 *
 * // Get config for complexity estimation
 * const config = tuner.getConfig();
 * const multiplier = config.language_complexity_multipliers.tier_a;
 * ```
 */

import { TunerClient, createTunerClient, TunerClientError } from '../client/tuner-client.js';
import type { PlannerConfig } from '../domain/config.js';

/**
 * Configuration for Planner integration.
 */
export interface PlannerIntegrationConfig {
  /** Tuner service URL (default: http://localhost:3005) */
  tunerUrl: string;
  /** Refresh interval in ms (default: 300000 = 5 minutes) */
  refreshInterval: number;
  /** Whether to use defaults when Tuner is unavailable */
  useDefaultsWhenUnavailable: boolean;
}

const DEFAULT_CONFIG: PlannerIntegrationConfig = {
  tunerUrl: 'http://localhost:3005',
  refreshInterval: 300000, // 5 minutes - Planner config changes less frequently
  useDefaultsWhenUnavailable: true,
};

/**
 * Default planner config when Tuner is unavailable.
 */
const FALLBACK_PLANNER_CONFIG: PlannerConfig = {
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

/**
 * Planner integration with Tuner.
 * Provides cached config for complexity estimation.
 */
export class PlannerIntegration {
  private client: TunerClient;
  private config: PlannerIntegrationConfig;
  private cachedConfig: PlannerConfig | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private available = false;

  constructor(config: Partial<PlannerIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = createTunerClient({ baseUrl: this.config.tunerUrl });
  }

  /**
   * Initialize integration - check availability and fetch config.
   */
  async initialize(): Promise<void> {
    this.available = await this.client.isAvailable();

    if (this.available) {
      await this.refreshConfig();
      this.startAutoRefresh();
      console.log('[Planner-Tuner] Connected to Tuner service');
    } else if (this.config.useDefaultsWhenUnavailable) {
      this.cachedConfig = FALLBACK_PLANNER_CONFIG;
      console.log('[Planner-Tuner] Tuner unavailable - using default config');
    } else {
      throw new TunerClientError('Tuner service unavailable');
    }
  }

  /**
   * Get current planner config.
   * Returns cached config for fast access.
   */
  getConfig(): PlannerConfig {
    return this.cachedConfig ?? FALLBACK_PLANNER_CONFIG;
  }

  /**
   * Check if Tuner is available.
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Get complexity multiplier for a language tier.
   */
  getLanguageMultiplier(tier: 's' | 'a' | 'b' | 'c' | 'd'): number {
    const config = this.getConfig();
    const key = `tier_${tier}` as keyof typeof config.language_complexity_multipliers;
    return config.language_complexity_multipliers[key];
  }

  /**
   * Calculate complexity score for a step.
   */
  calculateComplexity(params: {
    descriptionTokens: number;
    scopeCount: number;
    dependencyCount: number;
    acCount: number;
    hasComplexKeywords?: boolean;
    languageTier?: 's' | 'a' | 'b' | 'c' | 'd';
  }): number {
    const config = this.getConfig();
    const weights = config.complexity_weights;

    let score =
      params.descriptionTokens * weights.description_tokens +
      params.scopeCount * weights.scope_count +
      params.dependencyCount * weights.dependency_count +
      params.acCount * weights.ac_count;

    if (params.hasComplexKeywords) {
      score += weights.keyword_boost;
    }

    // Apply language multiplier
    const languageMultiplier = params.languageTier
      ? this.getLanguageMultiplier(params.languageTier)
      : 1.0;

    return score * languageMultiplier;
  }

  /**
   * Force refresh config from Tuner.
   */
  async refreshConfig(): Promise<void> {
    if (!this.available) return;

    try {
      this.cachedConfig = await this.client.getPlannerConfig();
    } catch (error) {
      console.error('[Planner-Tuner] Failed to refresh config:', error);
    }
  }

  /**
   * Stop auto-refresh timer.
   */
  shutdown(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Start periodic config refresh.
   */
  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.refreshConfig();
    }, this.config.refreshInterval);
  }
}

/**
 * Create a Planner integration instance with default configuration.
 */
export function createPlannerIntegration(config?: Partial<PlannerIntegrationConfig>): PlannerIntegration {
  return new PlannerIntegration(config);
}
