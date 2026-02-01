/**
 * Planner Core Package
 *
 * Plan authoring and versioning for the agentic system.
 *
 * @packageDocumentation
 */

import type { Router } from 'express';
import { SqliteStorage } from './storage/sqlite.js';
import { createRouter } from './api/routes.js';

// =============================================================================
// Plugin Interface (for mounting in server)
// =============================================================================

export interface PlannerServiceConfig {
  /** Path to SQLite database file */
  dbPath?: string;
}

export interface PlannerService {
  /** Express router to mount at /api */
  router: Router;
  /** Initialize storage (no-op for planner - tables created in constructor) */
  initialize: () => void;
  /** Shutdown service (closes DB connection) */
  shutdown: () => void;
  /** Get storage instance (for relay services that need it) */
  getStorage: () => SqliteStorage;
}

/**
 * Create planner service for mounting in another Express app.
 *
 * @example
 * ```typescript
 * import { createPlannerService } from 'planner-core';
 *
 * const planner = createPlannerService({ dbPath: './planner.db' });
 * planner.initialize();
 * app.use('/api', planner.router);
 * ```
 */
export function createPlannerService(config: PlannerServiceConfig = {}): PlannerService {
  const dbPath = config.dbPath || './planner.db';
  const storage = new SqliteStorage(dbPath);
  const router = createRouter(storage);

  return {
    router,
    initialize: () => {
      // SqliteStorage initializes tables in constructor, so this is a no-op.
      // Kept for interface consistency with other services.
    },
    shutdown: () => storage.close(),
    getStorage: () => storage,
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
