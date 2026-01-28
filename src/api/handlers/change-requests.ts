import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PlanStorage } from '../../storage/interface.js';
import {
  SuggestedChangesSchema,
  createChangeRequest,
} from '../../domain/change-request.js';
import { PlanStatus } from '../../domain/status.js';
import type { Step } from '../../domain/step.js';
import type { PlanVersion } from '../../domain/plan.js';
import { HttpError } from '../middleware.js';

/**
 * Request schema for creating a change request.
 */
export const CreateChangeRequestSchema = z.object({
  plan_id: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
  suggested_changes: SuggestedChangesSchema,
});

export type CreateChangeRequestRequest = z.infer<typeof CreateChangeRequestSchema>;

interface RunIdParams {
  run_id: string;
}

interface PlanIdParams {
  id: string;
}

/**
 * Apply suggested changes to a base version's steps.
 */
function applySuggestedChanges(baseSteps: Step[], changes: z.infer<typeof SuggestedChangesSchema>): Step[] {
  let steps = [...baseSteps];

  // Remove steps
  if (changes.remove_steps && changes.remove_steps.length > 0) {
    const removeSet = new Set(changes.remove_steps);
    steps = steps.filter((step) => !removeSet.has(step.step_id));
  }

  // Modify steps
  if (changes.modify_steps && changes.modify_steps.length > 0) {
    for (const mod of changes.modify_steps) {
      const idx = steps.findIndex((s) => s.step_id === mod.step_id);
      if (idx !== -1) {
        const existing = steps[idx]!;
        steps[idx] = {
          ...existing,
          ...(mod.title !== undefined && { title: mod.title }),
          ...(mod.description !== undefined && { description: mod.description }),
          ...(mod.scope !== undefined && { scope: mod.scope }),
          ...(mod.owner_role !== undefined && { owner_role: mod.owner_role }),
          ...(mod.dependencies !== undefined && { dependencies: mod.dependencies }),
        };
      }
    }
  }

  // Add steps
  if (changes.add_steps && changes.add_steps.length > 0) {
    steps = [...steps, ...changes.add_steps];
  }

  return steps;
}

/**
 * Create change request handlers.
 */
export function createChangeRequestHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /runs/:run_id/change-requests
     * Create a new change request from Orchestrator.
     */
    create: (
      req: Request<RunIdParams>,
      res: Response,
      next: NextFunction
    ): void => {
      try {
        const runId = req.params.run_id;
        const parsed = CreateChangeRequestSchema.parse(req.body);

        // Verify plan exists
        const plan = storage.getPlan(parsed.plan_id);
        if (!plan) {
          throw new HttpError(404, 'Plan not found');
        }

        // Get the latest published version to base changes on
        const versions = storage.listVersions(parsed.plan_id);
        const publishedVersion = versions.find((v) => v.status === PlanStatus.Published);

        if (!publishedVersion) {
          throw new HttpError(400, 'No published version found to base changes on');
        }

        // Create change request
        const changeRequest = createChangeRequest(
          runId,
          parsed.plan_id,
          parsed.reason,
          parsed.suggested_changes
        );
        storage.createChangeRequest(changeRequest);

        // Create new draft version from published version with changes applied
        const latestVersion = storage.getLatestVersion(parsed.plan_id);
        const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

        const newSteps = applySuggestedChanges(publishedVersion.steps, parsed.suggested_changes);

        const now = new Date().toISOString();
        const newVersion: PlanVersion = {
          plan_id: parsed.plan_id,
          version: newVersionNumber,
          status: PlanStatus.Draft,
          summary: { ...publishedVersion.summary },
          steps: newSteps,
          change_request_id: changeRequest.change_request_id,
          created_at: now,
          updated_at: now,
        };

        storage.createVersion(newVersion);

        // Update change request with result version
        storage.updateChangeRequestStatus(
          changeRequest.change_request_id,
          'applied',
          newVersionNumber
        );

        res.status(201).json({
          change_request: storage.getChangeRequest(changeRequest.change_request_id),
          new_version: storage.getVersion(parsed.plan_id, newVersionNumber),
        });
      } catch (error) {
        next(error);
      }
    },

    /**
     * GET /runs/:run_id/change-requests
     * List change requests for a run.
     */
    listByRun: (
      req: Request<RunIdParams>,
      res: Response,
      next: NextFunction
    ): void => {
      try {
        const runId = req.params.run_id;
        const changeRequests = storage.listChangeRequestsByRun(runId);

        // Include linked version info
        const results = changeRequests.map((cr) => {
          const linkedVersion = cr.result_version
            ? storage.getVersion(cr.plan_id, cr.result_version)
            : null;
          return {
            ...cr,
            linked_version: linkedVersion,
          };
        });

        res.json({ change_requests: results });
      } catch (error) {
        next(error);
      }
    },

    /**
     * GET /plans/:id/change-requests
     * List change requests for a plan.
     */
    listByPlan: (
      req: Request<PlanIdParams>,
      res: Response,
      next: NextFunction
    ): void => {
      try {
        const planId = req.params.id;

        // Verify plan exists
        const plan = storage.getPlan(planId);
        if (!plan) {
          throw new HttpError(404, 'Plan not found');
        }

        const changeRequests = storage.listChangeRequestsByPlan(planId);

        // Include linked version info
        const results = changeRequests.map((cr) => {
          const linkedVersion = cr.result_version
            ? storage.getVersion(cr.plan_id, cr.result_version)
            : null;
          return {
            ...cr,
            linked_version: linkedVersion,
          };
        });

        res.json({ change_requests: results });
      } catch (error) {
        next(error);
      }
    },
  };
}
