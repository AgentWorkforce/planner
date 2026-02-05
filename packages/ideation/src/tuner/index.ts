/**
 * Tuner Integration for Ideation Package
 *
 * Provides access to Tuner-managed configuration and outcome recording.
 */

import {
  IdeationIntegration,
  createIdeationIntegration,
  type IdeationIntegrationConfig,
} from '../../../tuner/src/integrations/ideation-integration.js';
import {
  DEFAULT_IDEATION_CONFIG,
  type IdeationConfig,
} from '../../../tuner/src/domain/config.js';
import type { IdeationOutcome } from '../../../tuner/src/domain/outcome.js';

// Re-export types for convenience
export type {
  IdeationIntegrationConfig,
  IdeationConfig,
  IdeationOutcome,
};

export { DEFAULT_IDEATION_CONFIG };

// =============================================================================
// Singleton Instance
// =============================================================================

let tunerIntegration: IdeationIntegration | null = null;

/**
 * Get the current Tuner integration instance.
 * Returns null if not initialized.
 */
export function getTunerIntegration(): IdeationIntegration | null {
  return tunerIntegration;
}

/**
 * Initialize the Tuner integration.
 * Safe to call multiple times - returns existing instance.
 *
 * @param config - Optional configuration overrides
 * @returns Initialized integration instance
 */
export async function initTunerIntegration(
  config?: Partial<IdeationIntegrationConfig>
): Promise<IdeationIntegration> {
  if (!tunerIntegration) {
    tunerIntegration = createIdeationIntegration({
      tunerUrl: process.env.TUNER_URL ?? 'http://localhost:3005',
      refreshInterval: 60000, // 1 minute
      mockWhenUnavailable: true, // Graceful degradation
      ...config,
    });
    await tunerIntegration.initialize();
    console.log('[ideation-tuner] Integration initialized');
  }
  return tunerIntegration;
}

/**
 * Shutdown the Tuner integration.
 * Stops background polling and cleans up resources.
 */
export function stopTunerIntegration(): void {
  if (tunerIntegration) {
    tunerIntegration.shutdown();
    tunerIntegration = null;
    console.log('[ideation-tuner] Integration stopped');
  }
}
