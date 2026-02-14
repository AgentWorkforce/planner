/**
 * SSE broadcaster for real-time Cultivate events
 */

import type { SSEBroadcaster } from '../types.js';
import type { Response } from 'express';

/**
 * Create SSE broadcaster instance
 */
export function createSSEBroadcaster(): SSEBroadcaster {
  const clients: Set<Response> = new Set();

  return {
    /**
     * Broadcast an event to all connected clients
     */
    broadcast(event: string, data: unknown): void {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

      // Use Array.from to avoid downlevelIteration requirement
      for (const client of Array.from(clients)) {
        try {
          client.write(message);
        } catch (error) {
          console.error('[cultivate:sse] Failed to send to client:', error);
          clients.delete(client);
        }
      }
    },

    /**
     * Add a new SSE client
     * Returns a cleanup function to remove the client
     */
    addClient(res: Response): () => void {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Send initial connection confirmation
      res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

      // Add to clients set
      clients.add(res);

      // Cleanup function
      return () => {
        clients.delete(res);
      };
    },
  };
}
