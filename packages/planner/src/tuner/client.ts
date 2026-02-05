import {
  PlannerConfig,
  PlannerConfigSchema,
  DEFAULT_PLANNER_CONFIG,
} from './config.js';

// ============================================
// Types
// ============================================

export interface TunerClientOptions {
  /** Tuner URL (defaults to TUNER_URL env var) */
  url?: string;
  /** Refresh interval in milliseconds (default: 5 minutes) */
  refreshIntervalMs?: number;
  /** Whether to fetch config immediately on creation */
  fetchOnInit?: boolean;
}

export type TunerClientStatus = 'disabled' | 'initializing' | 'connected' | 'error' | 'stopped';

// ============================================
// Constants
// ============================================

const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CONFIG_ENDPOINT = '/api/planner-config';

// ============================================
// TunerClient
// ============================================

/**
 * Client for fetching Planner configuration from Tuner service.
 * Provides graceful fallback to defaults if Tuner is unavailable.
 *
 * Usage:
 * ```
 * const client = createTunerClient();
 * await client.init(); // optional: fetch initial config
 * const config = client.getConfig();
 * // ... later
 * client.stop();
 * ```
 */
export class TunerClient {
  private config: PlannerConfig;
  private url: string | null;
  private refreshIntervalMs: number;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private status: TunerClientStatus;
  private lastFetchTime: Date | null = null;
  private lastError: Error | null = null;

  constructor(options: TunerClientOptions = {}) {
    this.url = options.url ?? process.env.TUNER_URL ?? null;
    this.refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    this.config = DEFAULT_PLANNER_CONFIG;

    if (!this.url) {
      this.status = 'disabled';
      console.log('[TunerClient] Tuner integration: disabled (TUNER_URL not set)');
    } else {
      this.status = 'initializing';
      console.log(`[TunerClient] Tuner integration: enabled (${this.url})`);
    }
  }

  /**
   * Initialize the client by fetching initial config.
   * Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.status === 'disabled') return;

    await this.fetchConfig();
    this.startRefreshInterval();
  }

  /**
   * Get the current configuration.
   * Returns cached config or defaults if unavailable.
   */
  getConfig(): PlannerConfig {
    return this.config;
  }

  /**
   * Get current client status.
   */
  getStatus(): TunerClientStatus {
    return this.status;
  }

  /**
   * Get the last fetch error, if any.
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get the last successful fetch time.
   */
  getLastFetchTime(): Date | null {
    return this.lastFetchTime;
  }

  /**
   * Manually trigger a config refresh.
   */
  async refresh(): Promise<PlannerConfig> {
    await this.fetchConfig();
    return this.config;
  }

  /**
   * Stop the refresh interval and cleanup.
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.status = 'stopped';
    console.log('[TunerClient] Stopped');
  }

  // ============================================
  // Private Methods
  // ============================================

  private startRefreshInterval(): void {
    if (this.refreshTimer || this.status === 'disabled') return;

    this.refreshTimer = setInterval(() => {
      this.fetchConfig().catch((err) => {
        console.error('[TunerClient] Refresh failed:', err);
      });
    }, this.refreshIntervalMs);

    console.log(
      `[TunerClient] Config refresh scheduled every ${this.refreshIntervalMs / 1000}s`
    );
  }

  private async fetchConfig(): Promise<void> {
    if (!this.url) return;

    try {
      const response = await fetch(`${this.url}${CONFIG_ENDPOINT}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const validated = PlannerConfigSchema.parse(data);

      this.config = validated;
      this.status = 'connected';
      this.lastFetchTime = new Date();
      this.lastError = null;

      console.log(
        `[TunerClient] Config fetched successfully (version: ${validated.version ?? 'unknown'})`
      );
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.status = 'error';

      console.warn(
        `[TunerClient] Failed to fetch config, using defaults: ${this.lastError.message}`
      );

      // Keep using cached/default config - graceful degradation
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a TunerClient instance.
 * Convenience function for dependency injection.
 */
export function createTunerClient(options?: TunerClientOptions): TunerClient {
  return new TunerClient(options);
}

// ============================================
// Singleton Instance
// ============================================

let defaultClient: TunerClient | null = null;

/**
 * Get the default TunerClient singleton.
 * Creates one if it doesn't exist.
 */
export function getDefaultTunerClient(): TunerClient {
  if (!defaultClient) {
    defaultClient = createTunerClient();
  }
  return defaultClient;
}

/**
 * Initialize the default TunerClient singleton.
 * Safe to call multiple times.
 */
export async function initDefaultTunerClient(): Promise<TunerClient> {
  const client = getDefaultTunerClient();
  await client.init();
  return client;
}

/**
 * Stop the default TunerClient singleton.
 */
export function stopDefaultTunerClient(): void {
  if (defaultClient) {
    defaultClient.stop();
    defaultClient = null;
  }
}
