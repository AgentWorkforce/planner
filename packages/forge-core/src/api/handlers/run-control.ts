import type { Request, Response } from 'express';
import type { ForgeStorage } from '../../storage/interface.js';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import { RunStatus, validateRunTransition } from '../../domain/types.js';
import { TrajectoryEventType } from '../../domain/trajectory-events.js';
import type { RunControlResponse } from '../schemas.js';

// ============================================
// Types
// ============================================

/**
 * Function to terminate active agents for a run.
 */
export type TerminateActiveAgentsFn = (runId: string) => Promise<void> | void;

/**
 * Function to schedule ready tasks (for resume).
 */
export type ScheduleReadyTasksFn = (runId: string) => void;

/**
 * Dependencies for run control handlers.
 */
export interface RunControlHandlerDeps {
  storage: ForgeStorage;
  trajectoryCapture?: TrajectoryCapture;
  terminateActiveAgents?: TerminateActiveAgentsFn;
  scheduleReadyTasks?: ScheduleReadyTasksFn;
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for POST /runs/:id/pause
 *
 * Pauses a running run, stopping new task scheduling.
 */
export function pauseRunHandler(deps: RunControlHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const runId = req.params.id as string;

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      // Get the run
      const run = deps.storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: `Run not found: ${runId}` });
        return;
      }

      // Validate state transition
      try {
        validateRunTransition(run.status, RunStatus.Paused);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        res.status(409).json({
          error: error.message,
          code: 'INVALID_STATE_TRANSITION',
        });
        return;
      }

      const previousStatus = run.status;

      // Update run status
      const updatedRun = deps.storage.updateRunStatus(runId, RunStatus.Paused);
      if (!updatedRun) {
        throw new Error('Failed to update run status');
      }

      // Emit trajectory event
      if (deps.trajectoryCapture) {
        deps.trajectoryCapture.capture(runId, TrajectoryEventType.RunPaused, {
          reason: 'Manual pause via API',
        });
      }

      const response: RunControlResponse = {
        run_id: updatedRun.run_id,
        status: updatedRun.status,
        previous_status: previousStatus,
        updated_at: updatedRun.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[RunControlHandler] Error pausing run:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /runs/:id/resume
 *
 * Resumes a paused run, continuing task scheduling.
 */
export function resumeRunHandler(deps: RunControlHandlerDeps) {
  return (req: Request, res: Response): void => {
    try {
      const runId = req.params.id as string;

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      // Get the run
      const run = deps.storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: `Run not found: ${runId}` });
        return;
      }

      // Validate state transition
      try {
        validateRunTransition(run.status, RunStatus.Running);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        res.status(409).json({
          error: error.message,
          code: 'INVALID_STATE_TRANSITION',
        });
        return;
      }

      const previousStatus = run.status;

      // Update run status
      const updatedRun = deps.storage.updateRunStatus(runId, RunStatus.Running);
      if (!updatedRun) {
        throw new Error('Failed to update run status');
      }

      // Emit trajectory event
      if (deps.trajectoryCapture) {
        deps.trajectoryCapture.capture(runId, TrajectoryEventType.RunResumed, {
          resumed_by: 'API',
          previous_status: previousStatus,
        });
      }

      // Resume task scheduling
      if (deps.scheduleReadyTasks) {
        setImmediate(() => {
          deps.scheduleReadyTasks?.(runId);
        });
      }

      const response: RunControlResponse = {
        run_id: updatedRun.run_id,
        status: updatedRun.status,
        previous_status: previousStatus,
        updated_at: updatedRun.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[RunControlHandler] Error resuming run:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /runs/:id/cancel
 *
 * Cancels a run, terminating all active agents.
 */
export function cancelRunHandler(deps: RunControlHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const runId = req.params.id as string;

      if (!runId) {
        res.status(400).json({ error: 'Run ID is required' });
        return;
      }

      // Get the run
      const run = deps.storage.getRun(runId);
      if (!run) {
        res.status(404).json({ error: `Run not found: ${runId}` });
        return;
      }

      // Validate state transition
      try {
        validateRunTransition(run.status, RunStatus.Cancelled);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        res.status(409).json({
          error: error.message,
          code: 'INVALID_STATE_TRANSITION',
        });
        return;
      }

      const previousStatus = run.status;

      // Terminate active agents first
      if (deps.terminateActiveAgents) {
        try {
          await deps.terminateActiveAgents(runId);
        } catch (termErr) {
          console.error('[RunControlHandler] Error terminating agents:', termErr);
          // Continue with cancellation even if agent termination fails
        }
      }

      // Update run status
      const updatedRun = deps.storage.updateRunStatus(runId, RunStatus.Cancelled);
      if (!updatedRun) {
        throw new Error('Failed to update run status');
      }

      // Emit trajectory event
      if (deps.trajectoryCapture) {
        deps.trajectoryCapture.capture(runId, TrajectoryEventType.RunCancelled, {
          reason: 'Manual cancellation via API',
          cancelled_by: 'API',
        });
      }

      const response: RunControlResponse = {
        run_id: updatedRun.run_id,
        status: updatedRun.status,
        previous_status: previousStatus,
        updated_at: updatedRun.updated_at,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[RunControlHandler] Error cancelling run:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type PauseRunHandlerFn = ReturnType<typeof pauseRunHandler>;
export type ResumeRunHandlerFn = ReturnType<typeof resumeRunHandler>;
export type CancelRunHandlerFn = ReturnType<typeof cancelRunHandler>;
