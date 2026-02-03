/**
 * Ideation Core Package
 *
 * Brainstorming facilitation for the Planner system.
 * The Interviewer guides users through ideation with invisible specialist support.
 *
 * @packageDocumentation
 */

import type { Router } from 'express';
import { SQLiteIdeationStorage, type IdeationStorage } from './storage/index.js';
import { createIdeationRouter } from './api/index.js';
import { initInterviewer, stopInterviewer } from './interviewer/index.js';

// =============================================================================
// Plugin Interface (for mounting in planner backend)
// =============================================================================

export interface IdeationServiceConfig {
  /** Path to SQLite database file */
  dbPath?: string;
}

export interface IdeationService {
  /** Express router to mount at /api/ideation */
  router: Router;
  /** Initialize storage (creates tables) */
  initialize: () => Promise<void>;
  /** Shutdown service (closes DB connection) */
  shutdown: () => Promise<void>;
  /** Get storage instance for external use */
  getStorage: () => IdeationStorage;
}

/**
 * Create ideation service for mounting in another Express app.
 *
 * @example
 * ```typescript
 * import { createIdeationService } from 'ideation-core';
 *
 * const ideation = createIdeationService({ dbPath: './ideation.db' });
 * await ideation.initialize();
 * app.use('/api/ideation', ideation.router);
 * ```
 */
export function createIdeationService(config: IdeationServiceConfig = {}): IdeationService {
  const dbPath = config.dbPath || './ideation.db';
  const storage = new SQLiteIdeationStorage(dbPath);
  const router = createIdeationRouter(storage);

  return {
    router,
    initialize: async () => {
      await storage.initialize();
      // Start the Interviewer service with storage access
      initInterviewer({ storage });
    },
    shutdown: async () => {
      stopInterviewer();
      await storage.close();
    },
    getStorage: () => storage,
  };
}

// =============================================================================
// Module Exports (for advanced usage)
// =============================================================================

// Domain Model
export * from './domain/index.js';

// Storage Layer
export * from './storage/index.js';

// API Layer
export * from './api/index.js';

// Interviewer (Lead Agent)
export * from './interviewer/index.js';

// Specialists (Dynamic Agents)
export * from './specialists/index.js';

// Relay Integration
export * from './relay/index.js';
