/**
 * Planner Core Package
 *
 * Plan authoring and versioning for the agentic system.
 *
 * @packageDocumentation
 */

import type { Router } from 'express';
import { SqliteStorage } from './storage/index.js';
import { createRouter } from './api/routes.js';
import {
  initDefaultTunerClient,
  stopDefaultTunerClient,
  getDefaultTunerClient,
  type TunerClient,
} from './tuner/index.js';

// =============================================================================
// Plugin Interface (for mounting in server)
// =============================================================================

export interface PlannerServiceConfig {
  /** Path to SQLite database file */
  dbPath?: string;
  /** Whether to enable Tuner integration (default: true if TUNER_URL is set) */
  enableTuner?: boolean;
}

export interface PlannerService {
  /** Express router to mount at /api */
  router: Router;
  /** Initialize storage and Tuner integration */
  initialize: () => Promise<void>;
  /** Shutdown service (closes DB connection and Tuner client) */
  shutdown: () => void;
  /** Get storage instance (for relay services that need it) */
  getStorage: () => SqliteStorage;
  /** Get TunerClient instance (for DOT services) */
  getTunerClient: () => TunerClient;
}

/**
 * Create planner service for mounting in another Express app.
 *
 * @example
 * ```typescript
 * import { createPlannerService } from 'planner-core';
 *
 * const planner = createPlannerService({ dbPath: './planner.db' });
 * await planner.initialize();
 * app.use('/api', planner.router);
 * ```
 */
export function createPlannerService(config: PlannerServiceConfig = {}): PlannerService {
  const dbPath = config.dbPath || './planner.db';
  const storage = new SqliteStorage(dbPath);
  const router = createRouter(storage);
  const enableTuner = config.enableTuner ?? !!process.env.TUNER_URL;

  return {
    router,
    initialize: async () => {
      // Initialize TunerClient for DOT framework config
      if (enableTuner) {
        console.log('[Planner] Initializing Tuner integration...');
        await initDefaultTunerClient();
        const client = getDefaultTunerClient();
        console.log(`[Planner] Tuner integration: ${client.getStatus()}`);
      } else {
        console.log('[Planner] Tuner integration: disabled');
      }
    },
    shutdown: () => {
      // Stop TunerClient refresh interval
      stopDefaultTunerClient();
      // Close storage connection
      storage.close();
      console.log('[Planner] Shutdown complete');
    },
    getStorage: () => storage,
    getTunerClient: () => getDefaultTunerClient(),
  };
}

// =============================================================================
// Module Exports (for advanced usage)
// =============================================================================

// Storage Layer
export * from './storage/index.js';

// API Layer
export * from './api/index.js';

// Domain Layer
export * from './domain/index.js';

// Events Layer
export * from './events/index.js';

// Tuner Integration (DOT Framework config)
export * from './tuner/index.js';

// DOT Services (complexity, language tier, limits, contracts)
export * from './services/index.js';
