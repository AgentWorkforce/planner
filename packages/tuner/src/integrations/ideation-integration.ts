/**
 * Ideation Integration Example
 *
 * Demonstrates how Ideation can integrate with Tuner for:
 * - Reading ideation configuration at startup
 * - Submitting ideation outcomes after sessions
 *
 * Usage in Ideation:
 * ```typescript
 * import { IdeationIntegration } from 'tuner/integrations/ideation-integration';
 *
 * const tuner = new IdeationIntegration();
 * await tuner.initialize();
 *
 * // Get config for session
 * const config = tuner.getConfig();
 *
 * // After session completes
 * tuner.recordOutcome(outcome);
 * ```
 */

import { TunerClient, createTunerClient, TunerClientError } from '../client/tuner-client.js';
import type { IdeationConfig } from '../domain/config.js';
import type { IdeationOutcome, PlanQualitySignal } from '../domain/outcome.js';

/**
 * Configuration for Ideation integration.
 */
export interface IdeationIntegrationConfig {
  /** Tuner service URL (default: http://localhost:3005) */
  tunerUrl: string;
  /** Refresh interval in ms (default: 60000 = 1 minute) */
  refreshInterval: number;
  /** Whether to run in mock mode when Tuner is unavailable */
  mockWhenUnavailable: boolean;
}

const DEFAULT_CONFIG: IdeationIntegrationConfig = {
  tunerUrl: 'http://localhost:3005',
  refreshInterval: 60000,
  mockWhenUnavailable: true,
};

/**
 * Ideation integration with Tuner.
 * Provides cached config access and fire-and-forget outcome submission.
 */
export class IdeationIntegration {
  private client: TunerClient;
  private config: IdeationIntegrationConfig;
  private cachedConfig: IdeationConfig | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private available = false;

  constructor(config: Partial<IdeationIntegrationConfig> = {}) {
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
      console.log('[Ideation-Tuner] Connected to Tuner service');
    } else if (this.config.mockWhenUnavailable) {
      console.log('[Ideation-Tuner] Tuner unavailable - running in mock mode');
    } else {
      throw new TunerClientError('Tuner service unavailable');
    }
  }

  /**
   * Get current ideation config.
   * Returns cached config for fast access.
   */
  getConfig(): IdeationConfig | null {
    return this.cachedConfig;
  }

  /**
   * Check if Tuner is available.
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Submit an ideation outcome (fire-and-forget).
   * Silently logs errors in mock mode.
   */
  async recordOutcome(outcome: IdeationOutcome): Promise<void> {
    if (!this.available) {
      console.log('[Ideation-Tuner] Mock mode - would record ideation outcome:', outcome.session_id);
      return;
    }

    try {
      await this.client.submitIdeationOutcome(outcome);
    } catch (error) {
      console.error('[Ideation-Tuner] Failed to record ideation outcome:', error);
      // Don't throw - fire-and-forget pattern
    }
  }

  /**
   * Submit a plan quality signal (fire-and-forget).
   */
  async recordPlanQualitySignal(signal: PlanQualitySignal): Promise<void> {
    if (!this.available) {
      console.log('[Ideation-Tuner] Mock mode - would record plan quality signal:', signal.plan_id);
      return;
    }

    try {
      await this.client.submitPlanQualitySignal(signal);
    } catch (error) {
      console.error('[Ideation-Tuner] Failed to record plan quality signal:', error);
    }
  }

  /**
   * Force refresh config from Tuner.
   */
  async refreshConfig(): Promise<void> {
    if (!this.available) return;

    try {
      this.cachedConfig = await this.client.getIdeationConfig();
    } catch (error) {
      console.error('[Ideation-Tuner] Failed to refresh config:', error);
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
 * Create an Ideation integration instance with default configuration.
 */
export function createIdeationIntegration(config?: Partial<IdeationIntegrationConfig>): IdeationIntegration {
  return new IdeationIntegration(config);
}
