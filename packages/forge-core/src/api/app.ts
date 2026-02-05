import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { errorHandler } from '@plannr/errors';
import { createForgeRouter, type ForgeRouterDeps } from './routes.js';
import type { ErrorResponse } from './schemas.js';

// ============================================
// Types
// ============================================

/**
 * Configuration for the Forge Express app.
 */
export interface ForgeAppConfig {
  /**
   * Port to listen on (default: 3001).
   */
  port?: number;

  /**
   * Application version string.
   */
  version?: string;

  /**
   * CORS configuration. Set to true to enable default CORS,
   * or provide cors options object.
   */
  cors?: boolean | cors.CorsOptions;

  /**
   * JSON body parser limit (default: '1mb').
   */
  jsonLimit?: string;

  /**
   * Enable request logging (default: true).
   */
  enableLogging?: boolean;
}

/**
 * Combined dependencies for creating the Forge app.
 */
export interface ForgeAppDeps extends ForgeRouterDeps {
  // All deps from ForgeRouterDeps
}

// ============================================
// Middleware
// ============================================

/**
 * Request logging middleware.
 */
function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path } = req;

  // Log on response finish
  _res.on('finish', () => {
    const duration = Date.now() - start;
    const status = _res.statusCode;
    console.log(`[Forge] ${method} ${path} ${status} ${duration}ms`);
  });

  next();
}

/**
 * 404 handler for unmatched routes.
 */
function notFoundHandler(_req: Request, res: Response): void {
  const response: ErrorResponse = {
    error: 'Not found',
    code: 'NOT_FOUND',
  };
  res.status(404).json(response);
}

// ============================================
// App Factory
// ============================================

/**
 * Creates a configured Express app for the Forge API.
 *
 * Middleware included:
 * - CORS (configurable)
 * - JSON body parser
 * - Request logging (optional)
 * - Error handling
 *
 * All routes are mounted at the root level:
 * - /health - Health check
 * - /runs/* - Run management
 * - /agents - Active agents
 * - /gates/* - Gate management
 * - /trajectory/* - Trajectory events
 *
 * @param deps - Dependencies for all handlers
 * @param config - App configuration
 * @returns Configured Express app
 */
export function createForgeApp(deps: ForgeAppDeps, config?: ForgeAppConfig): Express {
  const app = express();

  // Record start time for uptime tracking
  const startTime = new Date();

  // CORS middleware
  if (config?.cors === true) {
    app.use(cors());
  } else if (config?.cors && typeof config.cors === 'object') {
    app.use(cors(config.cors));
  }

  // JSON body parser
  app.use(express.json({ limit: config?.jsonLimit ?? '1mb' }));

  // Request logging
  if (config?.enableLogging !== false) {
    app.use(requestLogger);
  }

  // Create and mount the Forge router
  const router = createForgeRouter(deps, {
    version: config?.version,
    startTime,
  });
  app.use(router);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Creates and starts the Forge API server.
 *
 * @param deps - Dependencies for all handlers
 * @param config - App configuration
 * @returns Object with app instance and server, plus close function
 */
export async function startForgeServer(
  deps: ForgeAppDeps,
  config?: ForgeAppConfig
): Promise<{
  app: Express;
  server: ReturnType<Express['listen']>;
  close: () => Promise<void>;
}> {
  const app = createForgeApp(deps, config);
  const port = config?.port ?? 3001;

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[Forge] Server listening on port ${port}`);
      resolve({
        app,
        server,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) {
                rejectClose(err);
              } else {
                console.log('[Forge] Server stopped');
                resolveClose();
              }
            });
          }),
      });
    });
  });
}
