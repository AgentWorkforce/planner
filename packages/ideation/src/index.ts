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
import { createHttpPlannerClient } from './api/planner-client.js';

// =============================================================================
// Plugin Interface (for mounting in planner backend)
// =============================================================================

export interface IdeationServiceConfig {
  /** Path to SQLite database file */
  dbPath?: string;
  /** Base URL of the planner API (enables send-to-planner) */
  plannerUrl?: string;
  /** Specialist spawner callback (enables spawn_specialist MCP tool) */
  spawnAgent?: (sessionId: string, name: string, focus: string, context?: string) => Promise<string>;
  /** Report agent status callback (enables report_agent_status MCP tool) */
  reportStatus?: (agentId: string, state: string, options?: { activity?: string; thought?: string }) => void;
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

  // Create planner client if URL is configured (enables send-to-planner)
  const plannerClient = config.plannerUrl
    ? createHttpPlannerClient({ baseUrl: config.plannerUrl })
    : undefined;

  const router = createIdeationRouter({
    storage,
    plannerClient,
    spawnAgent: config.spawnAgent,
    reportStatus: config.reportStatus,
  });

  return {
    router,
    initialize: async () => {
      await storage.initialize();
    },
    shutdown: async () => {
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

// Specialists (Dynamic Agents)
export * from './specialists/index.js';

// Relay Integration
export * from './relay/index.js';
