import { type Router } from 'express';
import { createForgeStorage, type ForgeStorage } from './storage/index.js';
import { createForgeRouter } from './api/index.js';

// Domain exports
export * from './domain/index.js';

// Storage exports
export * from './storage/index.js';

// Services exports (durability & trajectory)
export * from './services/index.js';

// API exports (handlers & routes)
export * from './api/index.js';

// MCP exports (tools & server)
export * from './mcp/index.js';

// Config exports
export * from './config/index.js';

// Planner adapter exports
export * from './adapters/index.js';

// =============================================================================
// Service Factory (for server integration)
// =============================================================================

/**
 * Configuration for the Forge service factory.
 */
export interface ForgeServiceConfig {
  /**
   * Path to the SQLite database file.
   */
  dbPath?: string;
}

/**
 * Forge service instance for server integration.
 */
export interface ForgeService {
  /**
   * Express router with all Forge API endpoints.
   */
  router: Router;

  /**
   * Initialize the service (async for future compatibility).
   */
  initialize: () => Promise<void>;

  /**
   * Shutdown the service and close resources.
   */
  shutdown: () => void;

  /**
   * Get the underlying storage instance.
   */
  getStorage: () => ForgeStorage;
}

/**
 * Creates a Forge service instance for mounting in a parent Express app.
 *
 * This is the recommended way to integrate Forge as a plugin in a larger
 * server (similar to createPlannerService and createIdeationService).
 *
 * @param config - Service configuration
 * @returns ForgeService instance
 */
export function createForgeService(config: ForgeServiceConfig = {}): ForgeService {
  const dbPath = config.dbPath || './forge.db';

  // Create storage
  const storage = createForgeStorage(dbPath);

  // Create router with minimal dependencies
  const router = createForgeRouter({ storage });

  return {
    router,
    initialize: async () => {
      // Storage is initialized on creation, nothing async needed yet
    },
    shutdown: () => {
      storage.close();
    },
    getStorage: () => storage,
  };
}
