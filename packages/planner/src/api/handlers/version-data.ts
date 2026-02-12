import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import type { Context } from '../../domain/context.js';
import type { Understanding } from '../../domain/plan.js';
import { PlanStatus } from '../../domain/status.js';
import { notFound, badRequest } from '../middleware.js';

interface RoleParams {
  id: string;
  role: string;
}

/**
 * Creates handlers for PATCH routes that update version-level data
 * (context and understanding) on the latest draft version in-place.
 */
export function createVersionDataHandlers(storage: PlanStorage) {
  return {
    /**
     * PATCH /plans/:id/context/:role
     * Update context fields for a specific role on the latest draft version.
     * Body is a Record<string, unknown> representing the role's context fields.
     * Pass empty object {} to clear a role's context.
     */
    updateContext: (req: Request<RoleParams>, res: Response, next: NextFunction) => {
      try {
        const { id: planId, role } = req.params;
        const fields = req.body as Record<string, unknown>;

        const plan = storage.getPlan(planId);
        if (!plan) throw notFound('Plan');

        const latestVersion = storage.getLatestVersion(planId);
        if (!latestVersion) throw notFound('Version');

        if (latestVersion.status !== PlanStatus.Draft) {
          throw badRequest('Cannot update context on approved or published version');
        }

        // Merge role context into existing context
        const existingContext: Context = latestVersion.context ?? {};
        const updatedContext: Context = { ...existingContext };

        if (Object.keys(fields).length === 0) {
          // Empty object = delete this role's context
          delete updatedContext[role];
        } else {
          updatedContext[role] = fields;
        }

        const updated = storage.updateVersionContext(
          planId,
          latestVersion.version,
          updatedContext
        );
        if (!updated) throw notFound('Version');

        res.json({
          version: updated.version,
          context: updatedContext[role] ?? {},
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PATCH /plans/:id/understanding/:role
     * Update understanding observations for a specific role on the latest draft version.
     * Body is a partial AgentObservations object to merge into the role's observations.
     */
    updateUnderstanding: (req: Request<RoleParams>, res: Response, next: NextFunction) => {
      try {
        const { id: planId, role } = req.params;
        const input = req.body as Record<string, unknown>;

        const plan = storage.getPlan(planId);
        if (!plan) throw notFound('Plan');

        const latestVersion = storage.getLatestVersion(planId);
        if (!latestVersion) throw notFound('Version');

        if (latestVersion.status !== PlanStatus.Draft) {
          throw badRequest('Cannot update understanding on approved or published version');
        }

        // Merge into existing understanding
        const existingUnderstanding: Understanding = latestVersion.understanding ?? {};
        const updatedUnderstanding: Understanding = { ...existingUnderstanding };

        const now = new Date().toISOString();
        const existingRole = existingUnderstanding[role] ?? {};
        updatedUnderstanding[role] = {
          ...existingRole,
          ...input,
          updated_at: now,
        };

        const updated = storage.updateVersionUnderstanding(
          planId,
          latestVersion.version,
          updatedUnderstanding
        );
        if (!updated) throw notFound('Version');

        res.json({
          version: updated.version,
          observations: updatedUnderstanding[role],
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
