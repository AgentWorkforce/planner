import type { Request, Response } from 'express';
import { z } from 'zod';
import type { GateService, PendingGateInfo, ScheduleReadyTasksFn } from '../../services/gate-service.js';

// ============================================
// Request Validation Schemas
// ============================================

/**
 * Request body for approving a gate.
 */
export const ApproveGateRequestSchema = z.object({
  decided_by: z.string().min(1, 'decided_by is required'),
  comment: z.string().optional(),
});

export type ApproveGateRequest = z.infer<typeof ApproveGateRequestSchema>;

/**
 * Request body for rejecting a gate.
 */
export const RejectGateRequestSchema = z.object({
  decided_by: z.string().min(1, 'decided_by is required'),
  reason: z.string().min(1, 'reason is required'),
  comment: z.string().optional(),
});

export type RejectGateRequest = z.infer<typeof RejectGateRequestSchema>;

/**
 * Query parameters for listing pending gates.
 */
export const ListPendingGatesQuerySchema = z.object({
  run_id: z.string().uuid().optional(),
});

export type ListPendingGatesQuery = z.infer<typeof ListPendingGatesQuerySchema>;

// ============================================
// Response Types
// ============================================

/**
 * Response for gate approval/rejection.
 */
export interface GateDecisionResponse {
  gate_id: string;
  task_id: string;
  status: string;
  decided_by: string;
  decided_at: string;
  comment?: string;
}

/**
 * Response for listing pending gates.
 */
export interface PendingGatesResponse {
  gates: PendingGateInfo[];
  total: number;
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for POST /gates/:taskId/approve
 *
 * Approves a gate and resumes task execution.
 */
export function approveGateHandler(
  gateService: GateService,
  scheduleReadyTasks?: ScheduleReadyTasksFn
) {
  return (req: Request, res: Response): void => {
    try {
      const taskId = req.params.taskId as string;

      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }

      // Validate request body
      const bodyResult = ApproveGateRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Approve the gate
      const result = gateService.approveGate(
        taskId,
        {
          decidedBy: body.decided_by,
          comment: body.comment,
        },
        scheduleReadyTasks
      );

      const response: GateDecisionResponse = {
        gate_id: result.gate.gate_id,
        task_id: result.gate.task_id,
        status: result.gate.status,
        decided_by: result.gate.decided_by ?? body.decided_by,
        decided_at: result.gate.decided_at ?? new Date().toISOString(),
        comment: result.gate.comment,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Handle specific error cases
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('already decided')) {
        res.status(409).json({ error: error.message });
        return;
      }

      console.error('[GateHandler] Error approving gate:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /gates/:taskId/reject
 *
 * Rejects a gate and fails the task.
 */
export function rejectGateHandler(gateService: GateService) {
  return (req: Request, res: Response): void => {
    try {
      const taskId = req.params.taskId as string;

      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }

      // Validate request body
      const bodyResult = RejectGateRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Reject the gate
      const result = gateService.rejectGate(taskId, {
        decidedBy: body.decided_by,
        reason: body.reason,
        comment: body.comment,
      });

      const response: GateDecisionResponse = {
        gate_id: result.gate.gate_id,
        task_id: result.gate.task_id,
        status: result.gate.status,
        decided_by: result.gate.decided_by ?? body.decided_by,
        decided_at: result.gate.decided_at ?? new Date().toISOString(),
        comment: result.gate.comment,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Handle specific error cases
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('already decided')) {
        res.status(409).json({ error: error.message });
        return;
      }

      console.error('[GateHandler] Error rejecting gate:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /gates/pending
 *
 * Returns list of pending gates, optionally filtered by run_id.
 */
export function listPendingGatesHandler(gateService: GateService) {
  return (req: Request, res: Response): void => {
    try {
      // Validate query parameters
      const queryResult = ListPendingGatesQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;

      // List pending gates
      const gates = gateService.listPendingGates(query.run_id);

      const response: PendingGatesResponse = {
        gates,
        total: gates.length,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[GateHandler] Error listing pending gates:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type ApproveGateHandlerFn = ReturnType<typeof approveGateHandler>;
export type RejectGateHandlerFn = ReturnType<typeof rejectGateHandler>;
export type ListPendingGatesHandlerFn = ReturnType<typeof listPendingGatesHandler>;
