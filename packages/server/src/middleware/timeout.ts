/**
 * Request Timeout Middleware
 *
 * Prevents requests from hanging indefinitely by setting context-aware timeouts:
 * - Normal API requests: 30 seconds
 * - AI operations: 120 seconds
 * - SSE endpoints: No timeout (streaming)
 */

import type { Request, Response, NextFunction } from 'express';

/** Default timeout for normal API requests (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

/** Extended timeout for AI operations (120 seconds) */
const AI_TIMEOUT_MS = 120000;

/**
 * Request timeout middleware.
 * Sets appropriate timeout based on request path and responds with 503 on timeout.
 */
export function timeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip timeout for SSE endpoints (they stream indefinitely)
  if (req.path.includes('/events') || req.path.includes('/sse')) {
    return next();
  }

  // Determine timeout based on endpoint
  const timeoutMs = shouldUseExtendedTimeout(req.path) ? AI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  // Set request timeout
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Request Timeout',
        message: `Request exceeded ${timeoutMs / 1000}s timeout`,
      });
    }
  }, timeoutMs);

  // Clear timeout when response finishes
  res.on('finish', () => {
    clearTimeout(timer);
  });

  // Clear timeout on error
  res.on('close', () => {
    clearTimeout(timer);
  });

  next();
}

/**
 * Determine if a request should use extended timeout.
 * AI operations and chat endpoints need more time for LLM processing.
 */
function shouldUseExtendedTimeout(path: string): boolean {
  return (
    path.includes('/ai/') ||
    path.includes('/chat') ||
    path.includes('/planner-lead') ||
    path.includes('/ideation/sessions')
  );
}
