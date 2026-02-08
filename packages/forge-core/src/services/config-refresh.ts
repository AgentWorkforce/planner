/**
 * ConfigRefreshService - DOT Framework Configuration Refresh
 *
 * Periodically fetches configuration from Tuner and updates services.
 * This enables dynamic tuning without restarting Forge.
 *
 * Features:
 * - Periodic config polling
 * - Version-based change detection
 * - Service updates on config change
 * - Event emission for config changes
 */

import type { TrajectoryCapture } from './trajectory-capture.js';

// ============================================
// Types
// ============================================

/**
 * Configuration for the refresh service
 */
export interface ConfigRefreshConfig {
  /** Tuner service base URL */
  tunerUrl: string;
  /** Refresh interval in milliseconds (default: 60000 = 1 minute) */
  refreshIntervalMs: number;
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs: number;
  /** Whether to start polling immediately (default: true) */
  autoStart: boolean;
}

const DEFAULT_CONFIG: ConfigRefreshConfig = {
  tunerUrl: 'http://localhost:3005',
  refreshIntervalMs: 60000, // 1 minute
  timeoutMs: 5000,
  autoStart: true,
};

/**
 * Callback when config changes
 */
export type OnConfigChangeCallback = (config: TunerForgeConfig) => void;

/**
 * Forge configuration from Tuner
 */
export interface TunerForgeConfig {
  /** Execution policy defaults */
  execution_policy?: {
    budgets?: {
      per_task_token_limit?: number;
      per_task_time_limit_seconds?: number;
      total_cost_limit_usd?: number;
    };
    retry?: {
      max_attempts?: number;
      escalation_threshold?: number;
    };
    parallelism?: {
      max_concurrent_tasks?: number;
      max_concurrent_per_scope?: number;
    };
    confidence?: {
      min_confidence_threshold?: number;
      review_threshold?: number;
    };
  };
  /** Model routing rules */
  model_routing?: Array<{
    condition: string;
    model: string;
    complexity_threshold?: number;
  }>;
  /** Config version for change detection */
  version?: number;
}

// ============================================
// ConfigRefreshService
// ============================================

/**
 * ConfigRefreshService polls Tuner for configuration changes
 * and updates Forge services accordingly.
 */
export class ConfigRefreshService {
  private config: ConfigRefreshConfig;
  private trajectoryCapture: TrajectoryCapture | null;
  private currentConfig: TunerForgeConfig | null = null;
  private currentVersion: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: OnConfigChangeCallback[] = [];
  private isRunning: boolean = false;

  constructor(options?: {
    config?: Partial<ConfigRefreshConfig>;
    trajectoryCapture?: TrajectoryCapture;
  }) {
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
    this.trajectoryCapture = options?.trajectoryCapture ?? null;

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Starts the config refresh polling.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Initial fetch
    this.refresh().catch(err => {
      console.warn('[ConfigRefresh] Initial config fetch failed:', err.message);
    });

    // Start polling
    this.intervalId = setInterval(() => {
      this.refresh().catch(err => {
        console.warn('[ConfigRefresh] Config refresh failed:', err.message);
      });
    }, this.config.refreshIntervalMs);

    console.log(
      `[ConfigRefresh] Started polling Tuner at ${this.config.tunerUrl} ` +
      `every ${this.config.refreshIntervalMs}ms`
    );
  }

  /**
   * Stops the config refresh polling.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[ConfigRefresh] Stopped polling');
  }

  /**
   * Registers a callback for config changes.
   *
   * @param callback - Function to call when config changes
   */
  onConfigChange(callback: OnConfigChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Gets the current configuration.
   */
  getCurrentConfig(): TunerForgeConfig | null {
    return this.currentConfig;
  }

  /**
   * Gets the current config version.
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * Manually triggers a config refresh.
   */
  async refresh(): Promise<TunerForgeConfig | null> {
    try {
      // First check version to avoid unnecessary full fetches
      const versionResponse = await this.fetchWithTimeout(
        `${this.config.tunerUrl}/api/tuner/config/version`
      );
      const versionData = await versionResponse.json() as { forge_version: number };

      if (versionData.forge_version === this.currentVersion && this.currentConfig) {
        // No change
        return this.currentConfig;
      }

      // Fetch full config
      const configResponse = await this.fetchWithTimeout(
        `${this.config.tunerUrl}/api/tuner/config/forge`
      );
      const newConfig = await configResponse.json() as TunerForgeConfig;

      // Check for changes
      const hasChanged = this.currentConfig === null ||
        JSON.stringify(newConfig) !== JSON.stringify(this.currentConfig);

      if (hasChanged) {
        const previousVersion = this.currentVersion;
        this.currentConfig = newConfig;
        this.currentVersion = versionData.forge_version;

        // Log trajectory event
        this.logConfigChange(previousVersion, this.currentVersion, newConfig);

        // Notify callbacks
        for (const callback of this.callbacks) {
          try {
            callback(newConfig);
          } catch (err) {
            console.error('[ConfigRefresh] Callback error:', err);
          }
        }

        console.log(
          `[ConfigRefresh] Config updated: v${previousVersion} → v${this.currentVersion}`
        );
      }

      return newConfig;
    } catch (err) {
      // Tuner unavailable - use cached config
      if (this.currentConfig) {
        return this.currentConfig;
      }
      throw err;
    }
  }

  /**
   * Checks if the service is running.
   */
  isPolling(): boolean {
    return this.isRunning;
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private logConfigChange(
    previousVersion: number,
    newVersion: number,
    config: TunerForgeConfig
  ): void {
    if (!this.trajectoryCapture) return;

    this.trajectoryCapture.capture(
      'system', // System-level event, not run-specific
      'config_updated' as any,
      {
        previous_version: previousVersion,
        new_version: newVersion,
        changes: {
          has_execution_policy: !!config.execution_policy,
          has_model_routing: !!config.model_routing,
        },
      }
    );
  }
}

/**
 * Factory function to create ConfigRefreshService.
 */
export function createConfigRefreshService(options?: {
  config?: Partial<ConfigRefreshConfig>;
  trajectoryCapture?: TrajectoryCapture;
}): ConfigRefreshService {
  return new ConfigRefreshService(options);
}
