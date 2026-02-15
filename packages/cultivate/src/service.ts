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

      // Capture context locally to avoid TypeScript null checks in closures
      const shutdownContext = context;

      // Maximum shutdown timeout: 30 seconds
      const SHUTDOWN_TIMEOUT_MS = 30000;
      const shutdownStartTime = Date.now();

      /**
       * Helper to check if we've exceeded the shutdown timeout
       */
      const isTimedOut = () => {
        const elapsed = Date.now() - shutdownStartTime;
        return elapsed >= SHUTDOWN_TIMEOUT_MS;
      };

      /**
       * Helper to safely execute a shutdown step with error handling
       */
      const safeShutdownStep = async (
        stepName: string,
        fn: () => Promise<void>
      ): Promise<void> => {
        if (isTimedOut()) {
          console.warn(`[cultivate-service] ⚠ Skipping ${stepName} - shutdown timeout exceeded`);
          return;
        }

        try {
          console.log(`[cultivate-service] ${stepName}...`);
          await fn();
          console.log(`[cultivate-service] ✓ ${stepName} complete`);
        } catch (error) {
          console.error(`[cultivate-service] ✗ Error during ${stepName}:`, error);
          // Continue with remaining cleanup steps
        }
      };

      // Cleanup resources in reverse order of initialization:
      // 8. Workers → 7. Queues → 6. SSE → 5. (skip Tuner) → 4. (skip Anthropic) → 3. (skip ML) → 2. Redis → 1. Storage

      // Step 1: Stop BullMQ workers (wait for active jobs with timeout)
      await safeShutdownStep('Stopping BullMQ workers', async () => {
        if (!shutdownContext.workers) return;

        const workerClosePromises = Object.entries(shutdownContext.workers).map(
          async ([name, worker]) => {
            if (worker && typeof worker.close === 'function') {
              try {
                // BullMQ Worker.close() waits for active jobs to complete
                // We don't pass force=true, so it waits gracefully
                await worker.close();
                console.log(`[cultivate-service]   - Worker ${name} closed`);
              } catch (error) {
                console.error(`[cultivate-service]   - Error closing worker ${name}:`, error);
              }
            }
          }
        );

        await Promise.all(workerClosePromises);
      });

      // Step 2: Close BullMQ queues
      await safeShutdownStep('Closing BullMQ queues', async () => {
        if (!shutdownContext.queues) return;

        const queueClosePromises = Object.entries(shutdownContext.queues).map(
          async ([name, queue]) => {
            if (queue && typeof queue.close === 'function') {
              try {
                await queue.close();
                console.log(`[cultivate-service]   - Queue ${name} closed`);
              } catch (error) {
                console.error(`[cultivate-service]   - Error closing queue ${name}:`, error);
              }
            }
          }
        );

        await Promise.all(queueClosePromises);
      });

      // Step 3: Close SSE connections
      await safeShutdownStep('Closing SSE connections', async () => {
        if (!shutdownContext.sseBroadcaster) return;

        // The SSE broadcaster maintains a Set of Response objects
        // We need to end all active SSE connections
        // Access the clients Set directly if possible, or use a cleanup method
        // Since we don't have a direct cleanup method, we'll broadcast a shutdown event
        // and rely on clients to handle disconnect
        try {
          shutdownContext.sseBroadcaster.emit('shutdown' as any, {
            message: 'Cultivate service shutting down',
            timestamp: new Date().toISOString(),
          });
          console.log('[cultivate-service]   - SSE shutdown event broadcast');
        } catch (error) {
          console.error('[cultivate-service]   - Error broadcasting SSE shutdown:', error);
        }
      });

      // Step 4: Close Redis connection
      await safeShutdownStep('Closing Redis connection', async () => {
        if (!shutdownContext.redis) return;

        try {
          // Use quit() for graceful shutdown (waits for pending commands)
          // If we're out of time, we could use disconnect() instead
          if (isTimedOut()) {
            await shutdownContext.redis.disconnect();
            console.log('[cultivate-service]   - Redis disconnected (forced)');
          } else {
            await shutdownContext.redis.quit();
            console.log('[cultivate-service]   - Redis quit (graceful)');
          }
        } catch (error) {
          // If quit fails, try disconnect as fallback
          console.error('[cultivate-service]   - Error during Redis quit, attempting disconnect:', error);
          try {
            await shutdownContext.redis.disconnect();
          } catch (disconnectError) {
            console.error('[cultivate-service]   - Error during Redis disconnect:', disconnectError);
          }
        }
      });

      // Step 5: Close SQLite database
      await safeShutdownStep('Closing SQLite database', async () => {
        if (!shutdownContext.storage) return;

        if (typeof shutdownContext.storage.close === 'function') {
          await shutdownContext.storage.close();
          console.log('[cultivate-service]   - Database closed');
        } else {
          console.log('[cultivate-service]   - Storage has no close method, skipping');
        }
      });

      // Clear context references
      context = undefined;
      routerInstance = undefined;

      const shutdownDuration = Date.now() - shutdownStartTime;
      console.log(`[cultivate-service] ✅ Shutdown complete (${shutdownDuration}ms)`);
    },

    getContext: () => context,
  };

  return service;
}
