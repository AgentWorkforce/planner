/**
 * Source health tracking with escalation policy
 *
 * Implements failure tracking and progressive degradation for source adapters:
 * - 1 failure: status = 'warning' (degraded), emit nothing
 * - 3 consecutive failures: status = 'unhealthy', emit source:error SSE event
 * - 10 consecutive failures: status = 'disabled', emit source:error SSE event
 * - Auth error (401/403): immediately status = 'disabled', emit source:auth_expired
 */

import type { CultivateStorage } from '../storage/interface.js';
import type { SSEBroadcaster } from '../sse/broadcaster.js';

/**
 * Source health tracker with escalation policy
 */
export class SourceHealthTracker {
  constructor(
    private storage: CultivateStorage,
    private broadcaster?: SSEBroadcaster
  ) {}

  /**
   * Record a successful fetch — reset consecutive failures, set health to 'healthy'
   *
   * @param sourceConfigId - Source configuration ID
   */
  async recordSuccess(sourceConfigId: string): Promise<void> {
    await this.storage.updateSourceHealth(sourceConfigId, {
      health: 'healthy',
      consecutive_failures: 0,
      last_error: undefined,
    });
  }

  /**
   * Record a fetch failure with escalation policy:
   * - 1 failure: status = 'warning', emit nothing
   * - 3 consecutive failures: status = 'unhealthy', emit source:error SSE event
   * - 10 consecutive failures: status = 'disabled', emit source:error SSE event
   * - Auth error (401/403): immediately status = 'disabled', emit source:auth_expired
   *
   * @param sourceConfigId - Source configuration ID
   * @param error - Error that caused the failure
   * @param isAuthError - Whether this is an authentication error (401/403)
   */
  async recordFailure(sourceConfigId: string, error: Error, isAuthError = false): Promise<void> {
    // Get current source config to check consecutive failures
    const sourceConfig = await this.storage.getSourceConfigById(sourceConfigId);
    if (!sourceConfig) {
      console.error(`[HealthTracker] Source config ${sourceConfigId} not found`);
      return;
    }

    // Handle auth errors immediately
    if (isAuthError) {
      await this.storage.updateSourceHealth(sourceConfigId, {
        health: 'disabled',
        consecutive_failures: sourceConfig.consecutive_failures + 1,
        last_error: error.message,
      });

      // Emit auth_expired event
      if (this.broadcaster) {
        this.broadcaster.emitSourceAuthExpired({
          source_config_id: sourceConfigId,
          name: sourceConfig.name,
        });
      }

      return;
    }

    // Increment consecutive failures
    const newFailureCount = sourceConfig.consecutive_failures + 1;

    // Determine new health status based on escalation policy
    let newHealth: 'healthy' | 'warning' | 'unhealthy' | 'disabled' = 'healthy';
    let shouldEmitError = false;

    if (newFailureCount >= 10) {
      newHealth = 'disabled';
      shouldEmitError = true;
    } else if (newFailureCount >= 3) {
      newHealth = 'unhealthy';
      shouldEmitError = true;
    } else if (newFailureCount >= 1) {
      newHealth = 'warning';
      shouldEmitError = false;
    }

    // Update health in storage
    await this.storage.updateSourceHealth(sourceConfigId, {
      health: newHealth,
      consecutive_failures: newFailureCount,
      last_error: error.message,
    });

    // Emit SSE event on threshold crossings (3 or 10 failures)
    if (shouldEmitError && this.broadcaster) {
      this.broadcaster.emitSourceError({
        source_config_id: sourceConfigId,
        error: error.message,
        health: newHealth,
      });
    }
  }

  /**
   * Get current health status for a source
   *
   * @param sourceConfigId - Source configuration ID
   * @returns Current health information
   */
  async getHealth(sourceConfigId: string): Promise<{
    status: string;
    consecutive_failures: number;
    last_error?: string;
  }> {
    const sourceConfig = await this.storage.getSourceConfigById(sourceConfigId);
    if (!sourceConfig) {
      throw new Error(`Source config ${sourceConfigId} not found`);
    }

    return {
      status: sourceConfig.health,
      consecutive_failures: sourceConfig.consecutive_failures,
      last_error: sourceConfig.last_error,
    };
  }
}
