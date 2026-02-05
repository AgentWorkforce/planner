/**
 * ConfigWriter Service
 *
 * Generates ForgeExecutionConfig and PlannerConfig from learned parameters.
 * Applies stability checks before making changes and maintains version history.
 */

import type { ForgeExecutionConfig, PlannerConfig, IdeationConfig } from '../domain/config.js';
import { DEFAULT_FORGE_CONFIG, DEFAULT_PLANNER_CONFIG, DEFAULT_IDEATION_CONFIG } from '../domain/config.js';
import type { TunerStorage, ConfigVersion } from '../storage/interface.js';
import type { StabilityControls } from './stability-controls.js';
import type { ModelSelector } from './model-selector.js';
import type { BaselineService } from './baseline-service.js';
import type { IdeationBaselineService } from './ideation-baseline-service.js';

/**
 * ConfigWriter service.
 * Generates and manages configuration versions.
 */
export class ConfigWriter {
  constructor(
    private storage: TunerStorage,
    private stabilityControls: StabilityControls,
    private modelSelector: ModelSelector,
    private baselineService: BaselineService,
    private ideationBaselineService?: IdeationBaselineService  // Optional for backward compat
  ) {}

  /**
   * Generate current ForgeExecutionConfig from learned state.
   */
  generateForgeConfig(): ForgeExecutionConfig {
    const baselines = this.modelSelector.getModelBaselines();
    const totalSamples = this.storage.getTotalOutcomeCount();

    // Compute exploration rate with decay
    const explorationRate = this.computeExplorationRate(totalSamples);

    // Generate model selection rules from learned baselines
    const learnedRules = this.generateModelRules(baselines);

    // Merge with default config
    const config: ForgeExecutionConfig = {
      ...DEFAULT_FORGE_CONFIG,
      model_selection: {
        ...DEFAULT_FORGE_CONFIG.model_selection,
        exploration_rate: explorationRate,
        // Keep hard rules from defaults, learned rules would go here in v2
      },
      version: this.storage.getNextVersionNumber(),
      updated_at: new Date().toISOString(),
    };

    return config;
  }

  /**
   * Generate current PlannerConfig.
   * For v1, this mostly returns defaults with version tracking.
   */
  generatePlannerConfig(): PlannerConfig {
    const config: PlannerConfig = {
      ...DEFAULT_PLANNER_CONFIG,
      version: this.storage.getNextVersionNumber(),
      updated_at: new Date().toISOString(),
    };

    return config;
  }

  /**
   * Save a new config version to storage.
   */
  saveConfig(forgeConfig: ForgeExecutionConfig, plannerConfig: PlannerConfig, notes?: string): ConfigVersion {
    const version: ConfigVersion = {
      version: forgeConfig.version,
      forge_config: forgeConfig,
      planner_config: plannerConfig,
      generated_at: new Date().toISOString(),
      notes,
    };

    this.storage.insertConfigVersion(version);
    return version;
  }

  /**
   * Get the latest config version.
   */
  getLatestConfig(): ConfigVersion | null {
    return this.storage.getLatestConfigVersion();
  }

  /**
   * Get a specific config version.
   */
  getConfigVersion(version: number): ConfigVersion | null {
    return this.storage.getConfigVersion(version);
  }

  /**
   * List recent config versions (for audit trail).
   */
  listConfigVersions(limit: number = 10): ConfigVersion[] {
    return this.storage.listConfigVersions(limit);
  }

  /**
   * Get or generate current Forge config.
   * Returns cached version if recent, otherwise generates new.
   */
  getCurrentForgeConfig(): ForgeExecutionConfig {
    const latest = this.storage.getLatestConfigVersion();

    if (latest) {
      return latest.forge_config;
    }

    // No config yet - generate and save defaults
    const forgeConfig = this.generateForgeConfig();
    const plannerConfig = this.generatePlannerConfig();
    this.saveConfig(forgeConfig, plannerConfig, 'Initial config');

    return forgeConfig;
  }

  /**
   * Get or generate current Planner config.
   */
  getCurrentPlannerConfig(): PlannerConfig {
    const latest = this.storage.getLatestConfigVersion();

    if (latest) {
      return latest.planner_config;
    }

    // No config yet - generate and save defaults
    const forgeConfig = this.generateForgeConfig();
    const plannerConfig = this.generatePlannerConfig();
    this.saveConfig(forgeConfig, plannerConfig, 'Initial config');

    return plannerConfig;
  }

  /**
   * Compute exploration rate with decay.
   * Formula: max(0.02, 0.10 * exp(-n/1000))
   *
   * - Starts at 10% exploration
   * - Decays exponentially as samples grow
   * - Floors at 2% to always allow some exploration
   */
  computeExplorationRate(totalSamples: number): number {
    const minRate = 0.02;
    const startRate = 0.10;
    const decayFactor = 1000;

    return Math.max(minRate, startRate * Math.exp(-totalSamples / decayFactor));
  }

  /**
   * Generate current IdeationConfig from learned state.
   * Applies learning rules gated by stability controls.
   */
  generateIdeationConfig(): IdeationConfig {
    const baseline = this.ideationBaselineService?.getBaseline();

    const config: IdeationConfig = {
      ...DEFAULT_IDEATION_CONFIG,
      version: this.storage.getNextVersionNumber(),
      updated_at: new Date().toISOString(),
    };

    // No learning if no baseline data or insufficient samples
    if (!baseline || baseline.sample_count < 30) {
      return config;
    }

    // --- Confidence calibration ---
    // If questions are high, lower the confident_above threshold
    const confidenceCheck = this.stabilityControls.checkStability({
      totalTrials: baseline.sample_count,
      currentArmSamples: baseline.sample_count,
      parameterType: 'ideation_confidence',
    });

    if (confidenceCheck.canChange && baseline.mean_questions_per_plan > 3) {
      // More questions = lower confidence threshold (they're being conservative)
      // Reduce by up to 10 points based on question count
      const reduction = Math.min(10, Math.round(baseline.mean_questions_per_plan * 2));
      config.confidence_calibration.confident_above = Math.max(
        70, // Floor
        DEFAULT_IDEATION_CONFIG.confidence_calibration.confident_above - reduction
      );
    }

    // --- Readiness advisory ---
    // Set min_conversation_turns based on baseline
    const readinessCheck = this.stabilityControls.checkStability({
      totalTrials: baseline.sample_count,
      currentArmSamples: baseline.sample_count,
      parameterType: 'ideation_readiness',
    });

    if (readinessCheck.canChange) {
      // Set threshold to ~80% of mean turns (with floor of 2)
      config.readiness_advisory.min_conversation_turns = Math.max(
        2,
        Math.floor(baseline.mean_conversation_turns * 0.8)
      );
    }

    // --- Specialist deprioritization ---
    // Add specialists with < 20% contribution rate to deprioritized list
    const spawningCheck = this.stabilityControls.checkStability({
      totalTrials: baseline.sample_count,
      currentArmSamples: baseline.sample_count,
      parameterType: 'ideation_spawning',
    });

    if (spawningCheck.canChange && baseline.specialist_contribution_rates) {
      const deprioritized: string[] = [];
      for (const [specialist, rate] of Object.entries(baseline.specialist_contribution_rates)) {
        if (rate < 0.2) {
          deprioritized.push(specialist);
        }
      }
      if (deprioritized.length > 0) {
        config.specialist_spawning.deprioritized_specialists = deprioritized;
      }
    }

    return config;
  }

  /**
   * Get current ideation config.
   * For v1, just generate fresh each time.
   * Caching will be added when learning logic is implemented.
   */
  getCurrentIdeationConfig(): IdeationConfig {
    return this.generateIdeationConfig();
  }

  /**
   * Generate model selection rules from learned baselines.
   * For v1, this returns empty (we use defaults).
   * In v2, this would learn optimal rules from performance data.
   */
  private generateModelRules(_baselines: unknown[]): unknown[] {
    // Placeholder for v2 learning
    // Would analyze baselines to generate rules like:
    // "For task_type=test with complexity=simple, haiku has 95% success rate"
    return [];
  }
}
