/**
 * Tuner client for adaptive configuration management
 *
 * Provides:
 * - Config polling from Tuner service (every 5 minutes)
 * - Graceful fallback to defaults when Tuner unavailable
 * - Outcome recording for adaptive learning
 * - Non-blocking initialization (never crashes on Tuner unavailability)
 */

import type { CultivateConfig, CultivateStorage } from '../types.js';
import { DEFAULT_CULTIVATE_CONFIG } from './defaults.js';

/**
 * User action outcome for a signal
 * Used for adaptive learning to tune filter rules and scoring weights
 */
export interface CultivateOutcome {
  /** Signal ID the action was taken on */
  signal_id: string;

  /** User action type */
  action: 'link' | 'dismiss' | 'ignore' | 'started_project';

  /** Greenhouse ID for contextual learning */
  greenhouse_id: string;

  /** Optional cluster ID for cluster-level learning */
  cluster_id?: string;

  /** Optional metadata for additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Tuner client for configuration management and outcome tracking
 *
 * Responsibilities:
 * - Fetch configuration from Tuner service periodically
 * - Provide current configuration to consumers
 * - Record user outcomes for adaptive learning
 * - Gracefully handle Tuner unavailability
 *
 * Design principles:
 * - Non-blocking: never throws on Tuner unavailability
 * - Graceful degradation: falls back to defaults
 * - Persistent: saves config to storage for resilience
 * - Self-healing: continues polling even after failures
 */
export class TunerClient {
  private config: CultivateConfig;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Create a new TunerClient
   *
   * @param tunerUrl - Tuner service URL (null if not configured)
   * @param storage - Cultivate storage instance for config persistence
   * @param initialConfig - Optional initial config (defaults to DEFAULT_CULTIVATE_CONFIG)
   */
  constructor(
    private tunerUrl: string | null,
    private storage: CultivateStorage,
    initialConfig?: CultivateConfig
  ) {
    this.config = initialConfig ?? DEFAULT_CULTIVATE_CONFIG;
  }

  /**
   * Get the current configuration
   *
   * @returns Current Cultivate configuration
   */
  getCurrentConfig(): CultivateConfig {
    return this.config;
  }

  /**
   * Start polling the Tuner service for configuration updates
   *
   * Polls every 5 minutes (300000ms).
   * Does nothing if tunerUrl is null.
   * Safe to call multiple times (idempotent).
   */
  startPolling(): void {
    if (!this.tunerUrl) {
      console.log('[TunerClient] No tunerUrl configured, polling disabled');
      return;
    }

    if (this.pollInterval) {
      console.warn('[TunerClient] Polling already started');
      return;
    }

    console.log('[TunerClient] Starting config polling (every 5 minutes)');

    // Initial fetch
    this.fetchConfig().catch((err) => {
      console.error('[TunerClient] Initial config fetch failed:', err);
    });

    // Poll every 5 minutes
    this.pollInterval = setInterval(() => {
      this.fetchConfig().catch((err) => {
        console.error('[TunerClient] Config polling fetch failed:', err);
      });
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop polling the Tuner service
   *
   * Safe to call even if polling was never started.
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[TunerClient] Polling stopped');
    }
  }

  /**
   * Fetch configuration from Tuner service
   *
   * GET {tunerUrl}/api/tuner/config/cultivate
   *
   * On success:
   * - Updates this.config
   * - Saves to storage via storage.setConfig()
   * - Returns the new config
   *
   * On failure:
   * - Logs warning
   * - Returns null (caller can use getCurrentConfig() for fallback)
   * - Never throws
   *
   * @returns Fetched config on success, null on failure
   */
  async fetchConfig(): Promise<CultivateConfig | null> {
    if (!this.tunerUrl) {
      return null;
    }

    try {
      const url = `${this.tunerUrl}/api/tuner/config/cultivate`;
      console.log(`[TunerClient] Fetching config from ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        console.warn(
          `[TunerClient] Config fetch returned ${response.status}, using current config`
        );
        return null;
      }

      const config = (await response.json()) as CultivateConfig;

      // Update in-memory config
      this.config = config;

      // Persist to storage
      await this.storage.setConfig(config);

      console.log('[TunerClient] Config fetched and saved successfully');

      return config;
    } catch (err) {
      // Graceful degradation - log and return null
      console.warn('[TunerClient] Failed to fetch config:', err);
      return null;
    }
  }

  /**
   * Record a user outcome for adaptive learning
   *
   * POST {tunerUrl}/api/tuner/outcomes/cultivate
   * Body: CultivateOutcome
   *
   * If tunerUrl is null, silently skips (no-op).
   * Never throws - logs errors and continues.
   *
   * @param outcome - User action outcome to record
   */
  async recordOutcome(outcome: CultivateOutcome): Promise<void> {
    if (!this.tunerUrl) {
      // Silent skip when Tuner not configured
      return;
    }

    try {
      const url = `${this.tunerUrl}/api/tuner/outcomes/cultivate`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outcome),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        console.warn(
          `[TunerClient] Outcome recording returned ${response.status} for signal ${outcome.signal_id}`
        );
        return;
      }

      console.log(
        `[TunerClient] Outcome recorded: signal=${outcome.signal_id}, action=${outcome.action}`
      );
    } catch (err) {
      // Graceful degradation - log and continue
      console.warn(
        `[TunerClient] Failed to record outcome for signal ${outcome.signal_id}:`,
        err
      );
    }
  }
}
