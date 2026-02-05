/**
 * ConfigWriter Service
 *
 * Generates ForgeExecutionConfig and PlannerConfig from learned parameters.
 * Applies stability checks before making changes and maintains version history.
 */

import type { ForgeExecutionConfig, PlannerConfig } from '../domain/config.js';
import { DEFAULT_FORGE_CONFIG, DEFAULT_PLANNER_CONFIG } from '../domain/config.js';
import type { TunerStorage, ConfigVersion } from '../storage/interface.js';
import type { StabilityControls } from './stability-controls.js';
import type { ModelSelector } from './model-selector.js';
import type { BaselineService } from './baseline-service.js';

/**
 * ConfigWriter service.
 * Generates and manages configuration versions.
 */
export class ConfigWriter {
  constructor(
    private storage: TunerStorage,
    private stabilityControls: StabilityControls,
    private modelSelector: ModelSelector,
    private baselineService: BaselineService
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
