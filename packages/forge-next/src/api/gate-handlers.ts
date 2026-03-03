/**
 * Gate handlers — approve and reject human approval checkpoints.
 */

import type { Request, Response } from 'express';
import type { ForgeNextStorage } from '../storage/interface.js';
import type { GateManager } from '../gate-manager.js';
import { GateDecisionRequestSchema } from './schemas.js';

function routeParam(req: Request, key: string): string | null {
  const v = req.params[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export interface GateHandlerDeps {
  storage: ForgeNextStorage;
  gateManager: GateManager;
}

// ---------------------------------------------------------------------------
// GET /runs/:runId/gates
// ---------------------------------------------------------------------------

export function listGatesHandler(deps: GateHandlerDeps) {
  return (req: Request, res: Response): void => {
    const runId = routeParam(req, 'runId');
    if (!runId) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    const run = deps.storage.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run not found: ${runId}` });
      return;
    }

    const gates = deps.storage.listGatesByRun(runId);
    res.status(200).json({ gates });
  };
}

// ---------------------------------------------------------------------------
// POST /gates/:id/approve
// ---------------------------------------------------------------------------

export function approveGateHandler(deps: GateHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    const gateId = routeParam(req, 'id');
    if (!gateId) {
      res.status(400).json({ error: 'Gate ID is required' });
      return;
    }

    const parseResult = GateDecisionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const { approver, note } = parseResult.data;

    let gate;
    try {
      gate = await deps.gateManager.approveGate(gateId, approver, note);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Distinguish 404 from conflict states
      if (msg.includes('not found')) {
        res.status(404).json({ error: msg });
        return;
      }

      res.status(409).json({ error: msg });
      return;
    }

    res.status(200).json({ gate });
  };
}

// ---------------------------------------------------------------------------
// POST /gates/:id/reject
// ---------------------------------------------------------------------------

export function rejectGateHandler(deps: GateHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    const gateId = routeParam(req, 'id');
    if (!gateId) {
      res.status(400).json({ error: 'Gate ID is required' });
      return;
    }

    const parseResult = GateDecisionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const { approver, note } = parseResult.data;

    let gate;
    try {
      gate = await deps.gateManager.rejectGate(gateId, approver, note);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('not found')) {
        res.status(404).json({ error: msg });
        return;
      }

      res.status(409).json({ error: msg });
      return;
    }

    res.status(200).json({ gate });
  };
}
