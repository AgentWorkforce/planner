/**
 * Mull Service Factory
 *
 * Creates a Mull service instance for mounting in a parent Express app.
 * Follows the same pattern as createForgeService and createIdeationService.
 */

import { type Router } from 'express';
import { createMullRouter } from './api/routes.js';
import type { MullAdapter, MullConfig } from './domain/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the Mull service factory.
 */
export interface MullServiceConfig {
  /**
   * Directory where topic memory files are stored.
   * Default: './memory'
   */
  memoryDir?: string;

  /**
   * Pre-built adapter instances for session data access.
   * Can be provided at creation or later via setAdapters().
   */
  adapters?: MullAdapter[];

  /**
   * Partial MullConfig overrides merged with resolved config.
   */
  config?: Partial<MullConfig>;
}

/**
 * Mull service instance for server integration.
 */
export interface MullService {
  /**
   * Express router with all Mull API endpoints.
   */
  router: Router;

  /**
   * Initialize the service.
   */
  initialize: () => Promise<void>;

  /**
   * Shutdown the service and clean up resources.
   */
  shutdown: () => void;

  /**
   * Get current memory directory path.
   */
  getMemoryDir: () => string;

  /**
   * Set or replace the adapter instances.
   * Useful when adapters depend on other services that initialize later.
   */
  setAdapters: (adapters: MullAdapter[]) => void;
}

// =============================================================================
// Service Factory
// =============================================================================

/**
 * Creates a Mull service instance for mounting in a parent Express app.
 *
 * Usage:
 * ```typescript
 * const mullService = createMullService({ memoryDir: './memory' });
 * await mullService.initialize();
 * app.use('/api/mull', mullService.router);
 * ```
 */
export function createMullService(config: MullServiceConfig = {}): MullService {
  const memoryDir = config.memoryDir || './memory';

  // Mutable adapter list — can be updated after creation via setAdapters()
  let adapters: MullAdapter[] = config.adapters || [];

  // Create a proxy adapter list that always reads from the current `adapters` variable.
  // This ensures the router handlers always use the latest adapter set.
  const adapterProxy = {
    get current(): MullAdapter[] {
      return adapters;
    },
  };

  // Create router with a deps object that references the proxy
  const router = createMullRouter({
    get adapters() {
      return adapterProxy.current;
    },
    memoryDir,
    config: config.config,
  });

  console.log(`[mull] Service created (memoryDir: ${memoryDir})`);

  return {
    router,

    initialize: async () => {
      console.log(`[mull] Initialized (${adapters.length} adapter(s))`);
    },

    shutdown: () => {
      console.log('[mull] Shutting down');
    },

    getMemoryDir: () => memoryDir,

    setAdapters: (newAdapters: MullAdapter[]) => {
      adapters = newAdapters;
      console.log(`[mull] Adapters updated (${adapters.length} adapter(s))`);
    },
  };
}
