/**
 * Global SSE endpoint — broadcasts cross-session events to all connected tend clients.
 *
 * GET /api/events/global?exclude_session={sessionId}
 *
 * Clients pass their own session ID to exclude events originating from their
 * current session (you don't need a notification about your own build completing).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { onGlobal, type GlobalEvent } from './global-bus.js';

export function createGlobalSseRouter(): Router {
  const router = Router();

  router.get('/global', (req: Request, res: Response) => {
    const excludeSession = req.query.exclude_session as string | undefined;

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // Subscribe to global events
    const unsub = onGlobal((event: GlobalEvent) => {
      // Filter out events from the requesting session
      if (excludeSession && event.sourceSessionId === excludeSession) {
        return;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Keepalive every 30s
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30_000);

    // Cleanup on disconnect
    req.on('close', () => {
      unsub();
      clearInterval(keepalive);
    });
  });

  return router;
}
