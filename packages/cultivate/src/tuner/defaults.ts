/**
 * Default Cultivate configuration
 *
 * Provides sensible starting values when Tuner is unavailable or not configured.
 * These defaults are based on empirically-tested weights from the scoring module.
 */

import type { CultivateConfig } from '../types.js';

/**
 * Default Cultivate configuration
 *
 * Includes:
 * - Balanced baseline weights that sum to 1.0
 * - No filter rules enabled by default (empty filter_rules object)
 * - Moderate tier1_strictness (0.5)
 * - Tier 2 ML classification disabled by default
 * - Moderate tier2_threshold (0.3) if enabled
 * - Default AI models for extraction and clustering
 */
export const DEFAULT_CULTIVATE_CONFIG: CultivateConfig = {
  /**
   * Per-greenhouse scoring weights
   * Empty by default - global defaults will be used from scoring/weights.ts
   */
  weights: {},

  /**
   * Filter rule enablement
   * Empty by default - all registered rules are enabled
   */
  filter_rules: {},

  /**
   * Tier 1 filter strictness (0-1)
   * Lower = more permissive, higher = more strict
   */
  tier1_strictness: 0.5,

  /**
   * Whether to use Tier 2 ML classification
   * Disabled by default for faster processing
   */
  tier2_enabled: false,

  /**
   * Tier 2 feedback score threshold (0-1)
   * Signals below this are rejected as noise
   */
  tier2_threshold: 0.3,

  /**
   * AI model for signal extraction
   * Uses Sonnet 4 for balanced quality and speed
   */
  extract_model: 'claude-sonnet-4-latest',

  /**
   * AI model for cluster assignment
   * Uses Haiku 4.5 for fast clustering decisions
   */
  cluster_model: 'claude-haiku-4-5-20251001',
};
