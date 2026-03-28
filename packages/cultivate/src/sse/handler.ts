/**
 * SSE Route Handler
 *
 * Express handler factory for SSE endpoint.
 * Clients connect to /events to receive real-time updates.
 */

import type { Request, Response } from 'express';
import type { SSEBroadcaster } from './broadcaster.js';

/**
 * Creates an SSE handler for the /events route
 *
 * The handler:
 * 1. Adds the client to the broadcaster
 * 2. Returns an unsubscribe function
 * 3. Cleanup is handled automatically by broadcaster's addClient implementation
 *
 * @param broadcaster - SSE broadcaster instance
 * @returns Express route handler
 */
export function createSSEHandler(broadcaster: SSEBroadcaster) {
  return (req: Request, res: Response) => {
    // Add client to broadcaster (sets headers, sends initial event)
    const unsubscribe = broadcaster.addClient(res);

    // Client disconnection cleanup
    req.on('close', () => {
      unsubscribe();
    });

    // Handle errors
    req.on('error', (err) => {
      console.error('[SSE Handler] Connection error:', err);
      unsubscribe();
    });
  };
}
