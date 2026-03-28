/**
 * SSE Broadcaster Implementation
 *
 * Manages Server-Sent Events connections and broadcasts real-time updates
 * to all connected clients. Singleton instance created at startup.
 */

import type { Response } from 'express';
import type {
  CultivateSSEEvent,
  CultivateSSEPayloadMap,
  SignalNewPayload,
  SignalUpdatedPayload,
  ClusterNewPayload,
  ClusterUpdatedPayload,
  ClusterTrendingPayload,
  IngestionProgressPayload,
  IngestionCompletePayload,
  SourceErrorPayload,
  SourceAuthExpiredPayload,
} from './types.js';

/**
 * SSE broadcaster for real-time Cultivate events
 *
 * This class maintains a set of connected SSE clients and broadcasts
 * typed events to all subscribers. Includes heartbeat keepalive.
 */
export class SSEBroadcaster {
  private clients: Set<Response> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the heartbeat interval (30 seconds)
   * Sends SSE comment format to keep connections alive
   */
  start(): void {
    if (this.heartbeatInterval) {
      console.warn('[SSEBroadcaster] Heartbeat already running');
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      // Send SSE comment format (not an event, just a keepalive)
      const message = ': heartbeat\n\n';

      // Write to all clients, removing dead connections
      // Use Array.from to avoid downlevelIteration requirement
      for (const client of Array.from(this.clients)) {
        try {
          client.write(message);
        } catch (err) {
          console.error('[SSEBroadcaster] Heartbeat write error, removing client:', err);
          this.removeClient(client);
        }
      }
    }, 30000); // Every 30 seconds

    console.log('[SSEBroadcaster] Heartbeat started');
  }

  /**
   * Stop the heartbeat and close all client connections
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[SSEBroadcaster] Heartbeat stopped');
    }

    // Close all client connections
    // Use Array.from to avoid downlevelIteration requirement
    for (const client of Array.from(this.clients)) {
      try {
        client.end();
      } catch (err) {
        console.error('[SSEBroadcaster] Error closing client:', err);
      }
    }

    this.clients.clear();
    console.log('[SSEBroadcaster] All clients disconnected');
  }

  /**
   * Add a new SSE client connection
   *
   * Sets SSE headers, registers close handler, and sends initial connection event.
   *
   * @param res - Express Response object for the SSE connection
   * @returns Unsubscribe function to remove the client
   */
  addClient(res: Response): () => void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Flush headers to establish connection
    res.flushHeaders();

    // Add client to set
    this.clients.add(res);

    // Send initial connection event
    const connectMessage = `event: connected\ndata: ${JSON.stringify({ clientCount: this.clients.size })}\n\n`;
    try {
      res.write(connectMessage);
    } catch (err) {
      console.error('[SSEBroadcaster] Error writing connect message:', err);
      this.removeClient(res);
    }

    console.log(`[SSEBroadcaster] Client connected (total: ${this.clients.size})`);

    // Return unsubscribe function
    return () => this.removeClient(res);
  }

  /**
   * Remove a client from the broadcast set
   */
  removeClient(res: Response): void {
    const wasPresent = this.clients.delete(res);
    if (wasPresent) {
      console.log(`[SSEBroadcaster] Client removed (total: ${this.clients.size})`);
      try {
        res.end();
      } catch (err) {
        // Ignore errors on end() — connection may already be dead
      }
    }
  }

  /**
   * Number of connected clients (for health monitoring)
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Generic emit — write to all connected clients in SSE format
   *
   * Format: `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
   *
   * Dead connections are removed without crashing the broadcaster.
   *
   * @param event - SSE event name
   * @param data - Event payload
   */
  emit<E extends CultivateSSEEvent>(event: E, data: CultivateSSEPayloadMap[E]): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    const deadClients: Response[] = [];

    // Use Array.from to avoid downlevelIteration requirement
    for (const client of Array.from(this.clients)) {
      try {
        client.write(message);
      } catch (err) {
        console.error(`[SSEBroadcaster] Error writing event ${event}, marking client for removal:`, err);
        deadClients.push(client);
      }
    }

    // Remove dead connections
    for (const deadClient of deadClients) {
      this.removeClient(deadClient);
    }
  }

  /**
   * Typed convenience method: signal:new
   */
  emitSignalNew(payload: SignalNewPayload): void {
    this.emit('signal:new', payload);
  }

  /**
   * Typed convenience method: signal:updated
   */
  emitSignalUpdated(payload: SignalUpdatedPayload): void {
    this.emit('signal:updated', payload);
  }

  /**
   * Typed convenience method: cluster:new
   */
  emitClusterNew(payload: ClusterNewPayload): void {
    this.emit('cluster:new', payload);
  }

  /**
   * Typed convenience method: cluster:updated
   */
  emitClusterUpdated(payload: ClusterUpdatedPayload): void {
    this.emit('cluster:updated', payload);
  }

  /**
   * Typed convenience method: cluster:trending
   */
  emitClusterTrending(payload: ClusterTrendingPayload): void {
    this.emit('cluster:trending', payload);
  }

  /**
   * Typed convenience method: ingestion:progress
   */
  emitIngestionProgress(payload: IngestionProgressPayload): void {
    this.emit('ingestion:progress', payload);
  }

  /**
   * Typed convenience method: ingestion:complete
   */
  emitIngestionComplete(payload: IngestionCompletePayload): void {
    this.emit('ingestion:complete', payload);
  }

  /**
   * Typed convenience method: source:error
   */
  emitSourceError(payload: SourceErrorPayload): void {
    this.emit('source:error', payload);
  }

  /**
   * Typed convenience method: source:auth_expired
   */
  emitSourceAuthExpired(payload: SourceAuthExpiredPayload): void {
    this.emit('source:auth_expired', payload);
  }
}

/**
 * Factory function to create a new SSE broadcaster instance
 *
 * Called during startup sequence (Step 7)
 */
export function createSSEBroadcaster(): SSEBroadcaster {
  const broadcaster = new SSEBroadcaster();
  broadcaster.start();
  return broadcaster;
}
