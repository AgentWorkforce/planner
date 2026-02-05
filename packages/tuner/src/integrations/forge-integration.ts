/**
 * Forge Integration Example
 *
 * Demonstrates how Forge can integrate with Tuner for:
 * - Reading execution configuration at startup
 * - Submitting task/run outcomes after execution
 *
 * Usage in Forge:
 * ```typescript
 * import { ForgeIntegration } from 'tuner/integrations/forge-integration';
 *
 * const tuner = new ForgeIntegration();
 * await tuner.initialize();
 *
 * // Get config for task execution
 * const config = tuner.getConfig();
 *
 * // After task completes
 * tuner.recordTaskOutcome(outcome);
 * ```
 */

import { TunerClient, createTunerClient, TunerClientError } from '../client/tuner-client.js';
import type { ForgeExecutionConfig } from '../domain/config.js';
import type { TaskOutcome, RunOutcome } from '../domain/outcome.js';

/**
 * Configuration for Forge integration.
 */
export interface ForgeIntegrationConfig {
  /** Tuner service URL (default: http://localhost:3005) */
  tunerUrl: string;
  /** Refresh interval in ms (default: 60000 = 1 minute) */
  refreshInterval: number;
  /** Whether to run in mock mode when Tuner is unavailable */
  mockWhenUnavailable: boolean;
}

const DEFAULT_CONFIG: ForgeIntegrationConfig = {
  tunerUrl: 'http://localhost:3005',
  refreshInterval: 60000,
  mockWhenUnavailable: true,
};

/**
 * Forge integration with Tuner.
 * Provides cached config access and fire-and-forget outcome submission.
 */
export class ForgeIntegration {
  private client: TunerClient;
  private config: ForgeIntegrationConfig;
  private cachedConfig: ForgeExecutionConfig | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private available = false;

  constructor(config: Partial<ForgeIntegrationConfig> = {}) {
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
      console.log('[Forge-Tuner] Connected to Tuner service');
    } else if (this.config.mockWhenUnavailable) {
      console.log('[Forge-Tuner] Tuner unavailable - running in mock mode');
    } else {
      throw new TunerClientError('Tuner service unavailable');
    }
  }

  /**
   * Get current execution config.
   * Returns cached config for fast access.
   */
  getConfig(): ForgeExecutionConfig | null {
    return this.cachedConfig;
  }

  /**
   * Check if Tuner is available.
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Submit a task outcome (fire-and-forget).
   * Silently logs errors in mock mode.
   */
  async recordTaskOutcome(outcome: TaskOutcome): Promise<void> {
    if (!this.available) {
      console.log('[Forge-Tuner] Mock mode - would record task outcome:', outcome.task_id);
      return;
    }

    try {
      await this.client.submitTaskOutcome(outcome);
    } catch (error) {
      console.error('[Forge-Tuner] Failed to record task outcome:', error);
      // Don't throw - fire-and-forget pattern
    }
  }

  /**
   * Submit a run outcome (fire-and-forget).
   */
  async recordRunOutcome(outcome: RunOutcome): Promise<void> {
    if (!this.available) {
      console.log('[Forge-Tuner] Mock mode - would record run outcome:', outcome.run_id);
      return;
    }

    try {
      await this.client.submitRunOutcome(outcome);
    } catch (error) {
      console.error('[Forge-Tuner] Failed to record run outcome:', error);
    }
  }

  /**
   * Force refresh config from Tuner.
   */
  async refreshConfig(): Promise<void> {
    if (!this.available) return;

    try {
      this.cachedConfig = await this.client.getForgeConfig();
    } catch (error) {
      console.error('[Forge-Tuner] Failed to refresh config:', error);
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
 * Create a Forge integration instance with default configuration.
 */
export function createForgeIntegration(config?: Partial<ForgeIntegrationConfig>): ForgeIntegration {
  return new ForgeIntegration(config);
}
