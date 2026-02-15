/**
 * SSE event stream handler
 */

import type { RequestHandler } from 'express';
import type { SSEBroadcaster } from '../../types.js';

/**
 * Create SSE event stream handler with broadcaster dependency injection
 */
export function createEventsHandler(broadcaster: SSEBroadcaster) {
  /**
   * GET /events
   * Server-Sent Events stream for real-time updates
   */
  const stream: RequestHandler = (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Register client and get cleanup function
    const cleanup = broadcaster.addClient(res);

    // Handle client disconnect
    req.on('close', () => {
      cleanup();
    });
  };

  return { stream };
}
