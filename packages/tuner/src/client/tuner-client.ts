/**
 * TunerClient
 *
 * HTTP client for Forge and Planner to interact with the Tuner service.
 * Provides type-safe methods for:
 * - Submitting task/run outcomes
 * - Fetching configuration
 * - Reading insights
 */

import type { TaskOutcome, RunOutcome, IdeationOutcome, PlanQualitySignal } from '../domain/outcome.js';
import type { ForgeExecutionConfig, PlannerConfig, IdeationConfig } from '../domain/config.js';
import type { ModelBaseline } from '../domain/baseline.js';
import type { DriftAlert } from '../domain/drift.js';

/**
 * TunerClient configuration.
 */
export interface TunerClientConfig {
  /** Base URL for Tuner service (default: http://localhost:3005) */
  baseUrl: string;
  /** Request timeout in ms (default: 5000) */
  timeout: number;
}

const DEFAULT_CONFIG: TunerClientConfig = {
  baseUrl: 'http://localhost:3005',
  timeout: 5000,
};

/**
 * Response types
 */
export interface OutcomeResponse {
  received: boolean;
  id: string;
}

export interface ConfigVersionResponse {
  forge_version: number;
  planner_version: number;
}

/**
 * TunerClient - HTTP client for interacting with Tuner service.
 */
export class TunerClient {
  private config: TunerClientConfig;

  constructor(config: Partial<TunerClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Outcome Submission (Forge → Tuner)
  // ===========================================================================

  /**
   * Submit a task outcome.
   * Fire-and-forget: returns immediately after Tuner acknowledges receipt.
   */
  async submitTaskOutcome(outcome: TaskOutcome): Promise<OutcomeResponse> {
    const response = await this.post('/api/tuner/outcomes/task', outcome);
    return response.json() as Promise<OutcomeResponse>;
  }

  /**
   * Submit a run outcome.
   */
  async submitRunOutcome(outcome: RunOutcome): Promise<OutcomeResponse> {
    const response = await this.post('/api/tuner/outcomes/run', outcome);
    return response.json() as Promise<OutcomeResponse>;
  }

  // ===========================================================================
  // Configuration Reading (Forge/Planner ← Tuner)
  // ===========================================================================

  /**
   * Get current Forge configuration.
   * Forge should call this at startup and periodically refresh.
   */
  async getForgeConfig(): Promise<ForgeExecutionConfig> {
    const response = await this.get('/api/tuner/config/forge');
    return response.json() as Promise<ForgeExecutionConfig>;
  }

  /**
   * Get current Planner configuration.
   */
  async getPlannerConfig(): Promise<PlannerConfig> {
    const response = await this.get('/api/tuner/config/planner');
    return response.json() as Promise<PlannerConfig>;
  }

  /**
   * Get current Ideation configuration.
   */
  async getIdeationConfig(): Promise<IdeationConfig> {
    const response = await this.get('/api/tuner/config/ideation');
    return response.json() as Promise<IdeationConfig>;
  }

  /**
   * Get current config versions.
   * Useful for checking if config has changed.
   */
  async getConfigVersion(): Promise<ConfigVersionResponse> {
    const response = await this.get('/api/tuner/config/version');
    return response.json() as Promise<ConfigVersionResponse>;
  }

  /**
   * Submit an ideation outcome.
   */
  async submitIdeationOutcome(outcome: IdeationOutcome): Promise<OutcomeResponse> {
    const response = await this.post('/api/tuner/outcomes/ideation', outcome);
    return response.json() as Promise<OutcomeResponse>;
  }

  /**
   * Submit a plan quality signal.
   */
  async submitPlanQualitySignal(signal: PlanQualitySignal): Promise<OutcomeResponse> {
    const response = await this.post('/api/tuner/outcomes/plan-quality', signal);
    return response.json() as Promise<OutcomeResponse>;
  }

  // ===========================================================================
  // Insights Reading (Portfolio/CLI ← Tuner)
  // ===========================================================================

  /**
   * Get model baselines for performance analysis.
   */
  async getModelBaselines(): Promise<ModelBaseline[]> {
    const response = await this.get('/api/tuner/insights/models');
    return response.json() as Promise<ModelBaseline[]>;
  }

  /**
   * Get drift alerts.
   */
  async getDriftAlerts(options?: {
    severity?: 'warning' | 'critical';
    acknowledged?: boolean;
    limit?: number;
  }): Promise<DriftAlert[]> {
    const params = new URLSearchParams();
    if (options?.severity) params.set('severity', options.severity);
    if (options?.acknowledged !== undefined) params.set('acknowledged', String(options.acknowledged));
    if (options?.limit !== undefined) params.set('limit', String(options.limit));

    const query = params.toString();
    const url = query ? `/api/tuner/insights/drift-alerts?${query}` : '/api/tuner/insights/drift-alerts';
    const response = await this.get(url);
    return response.json() as Promise<DriftAlert[]>;
  }

  /**
   * Acknowledge a drift alert.
   */
  async acknowledgeDriftAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }> {
    const response = await this.post(`/api/tuner/insights/drift-alerts/${alertId}/ack`, {
      acknowledged_by: acknowledgedBy,
    });
    return response.json() as Promise<{ success: boolean }>;
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  /**
   * Check if Tuner service is healthy.
   */
  async health(): Promise<{ status: string }> {
    const response = await this.get('/api/health');
    return response.json() as Promise<{ status: string }>;
  }

  /**
   * Check if Tuner service is available.
   * Returns false if connection fails.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'ok';
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Internal HTTP Methods
  // ===========================================================================

  private async get(path: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new TunerClientError(
          `GET ${path} failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async post(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new TunerClientError(
          `POST ${path} failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Error class for TunerClient errors.
 */
export class TunerClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'TunerClientError';
  }
}

/**
 * Create a TunerClient with default configuration.
 */
export function createTunerClient(config?: Partial<TunerClientConfig>): TunerClient {
  return new TunerClient(config);
}
