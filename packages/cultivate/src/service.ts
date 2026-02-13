/**
 * Cultivate service factory for plugin architecture
 *
 * This module provides the main service interface for mounting Cultivate
 * as an Express plugin in a larger application.
 */

import type { Router } from 'express';
import { startCultivate } from './startup.js';
import { createCultivateRouter } from './routes.js';
import type { CultivateContext, CultivateStartupConfig, CultivateService } from './types.js';

/**
 * Configuration for creating a Cultivate service
 */
export interface CultivateServiceConfig {
  /** Path to SQLite database (default: ./cultivate.db) */
  dbPath?: string;

  /** Redis connection options */
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };

  /** Anthropic API key (uses ANTHROPIC_API_KEY env var if not provided) */
  anthropicApiKey?: string;

  /** Tuner service URL (optional - falls back to defaults if not available) */
  tunerUrl?: string;

  /** Secret for encrypting source credentials */
  encryptionSecret?: string;

  /** Model for extraction tasks (default: claude-sonnet-4-latest) */
  extractModel?: string;

  /** Model for clustering tasks (default: claude-haiku-4-latest) */
  clusterModel?: string;
}

/**
 * Create a Cultivate service for mounting as an Express plugin
 *
 * @example
 * ```typescript
 * import { createCultivateService } from '@plannr/cultivate';
 *
 * const cultivate = createCultivateService({
 *   dbPath: './cultivate.db',
 *   redis: { host: 'localhost', port: 6379 },
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * await cultivate.initialize();
 * app.use('/api/cultivate', cultivate.router);
 * ```
 *
 * @param config - Service configuration
 * @returns Service object with router, initialize, and shutdown
 */
export function createCultivateService(config: CultivateServiceConfig = {}): CultivateService {
  let context: CultivateContext | undefined;
  let routerInstance: Router | undefined;

  const service: CultivateService = {
    router: undefined as unknown as Router,
    initialize: async () => {
      console.log('[cultivate-service] Initializing...');

      // Build startup configuration with sensible defaults
      const startupConfig: CultivateStartupConfig = {
        redis: {
          host: config.redis?.host ?? 'localhost',
          port: config.redis?.port ?? 6379,
          password: config.redis?.password,
          db: config.redis?.db ?? 0,
        },
        dbPath: config.dbPath ?? './cultivate.db',
        anthropicApiKey: config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
        tunerUrl: config.tunerUrl ?? process.env.TUNER_URL,
        encryptionSecret: config.encryptionSecret ?? process.env.ENCRYPTION_SECRET ?? 'default-secret',
        extractModel: config.extractModel,
        clusterModel: config.clusterModel,
      };

      // Initialize Cultivate with all dependencies
      context = await startCultivate(startupConfig);

      // Create router with initialized context
      routerInstance = createCultivateRouter(context);

      // Store router in the service object for external access
      service.router = routerInstance;

      console.log('[cultivate-service] ✅ Initialization complete');
    },

    shutdown: async () => {
      console.log('[cultivate-service] Shutting down...');

      if (!context) {
        console.log('[cultivate-service] No context to shutdown');
        return;
      }

      // Cleanup resources in reverse order of initialization

      // Stop workers
      if (context.workers) {
        console.log('[cultivate-service] Stopping workers...');
        // Close each worker
        await Promise.all(
          Object.values(context.workers).map((worker) => {
            if (worker && typeof worker.close === 'function') {
              return worker.close();
            }
            return Promise.resolve();
          })
        );
      }

      // Close queues
      if (context.queues) {
        console.log('[cultivate-service] Closing queues...');
        await Promise.all(
          Object.values(context.queues).map((queue) => {
            if (queue && typeof queue.close === 'function') {
              return queue.close();
            }
            return Promise.resolve();
          })
        );
      }

      // Close Redis connection
      if (context.redis) {
        console.log('[cultivate-service] Closing Redis connection...');
        await context.redis.quit();
      }

      // Close storage (database connection)
      if (context.storage) {
        console.log('[cultivate-service] Closing storage...');
        if (typeof context.storage.close === 'function') {
          await context.storage.close();
        }
      }

      context = undefined;
      routerInstance = undefined;

      console.log('[cultivate-service] ✅ Shutdown complete');
    },

    getContext: () => context,
  };

  return service;
}
