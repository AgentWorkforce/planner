import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PlanStorage } from '../../storage/interface.js';
import { PlanStatus } from '../../domain/status.js';
import {
  canSubmit,
  canApprove,
  canPublish,
  generatePlanRef,
} from '../../domain/workflow.js';
import { notFound, badRequest } from '../middleware.js';

interface VersionParams {
  id: string;
  version: string;
}

/**
 * Request schema for approval endpoint.
 */
const ApproveRequestSchema = z.object({
  approver: z.string().min(1, 'Approver is required'),
});

/**
 * Creates workflow route handlers with injected storage dependency.
 */
export function createWorkflowHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /plans/:id/versions/:version/submit
     * Mark a draft version as submitted for review.
     */
    submit: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
      try {
        const { id, version: versionStr } = req.params;
        const versionNum = parseInt(versionStr, 10);
        if (isNaN(versionNum)) {
          throw badRequest('Invalid version number');
        }

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const version = storage.getVersion(id, versionNum);
        if (!version) {
          throw notFound('Version');
        }

        const check = canSubmit(version.status, version.submitted_at);
        if (!check.valid) {
          throw badRequest(check.error!);
        }

        const updated = storage.submitVersion(id, versionNum);
        if (!updated) {
          throw badRequest('Failed to submit version');
        }

        res.json({ version: updated });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions/:version/approve
     * Approve and lock a version.
     */
    approve: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
      try {
        const { id, version: versionStr } = req.params;
        const versionNum = parseInt(versionStr, 10);
        if (isNaN(versionNum)) {
          throw badRequest('Invalid version number');
        }

        const body = ApproveRequestSchema.parse(req.body);

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const version = storage.getVersion(id, versionNum);
        if (!version) {
          throw notFound('Version');
        }

        const check = canApprove(version.status, version.submitted_at);
        if (!check.valid) {
          throw badRequest(check.error!);
        }

        const approvalInfo = {
          approver: body.approver,
          approved_at: new Date().toISOString(),
        };

        const updated = storage.approveVersion(id, versionNum, approvalInfo);
        if (!updated) {
          throw badRequest('Failed to approve version');
        }

        res.json({ version: updated });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions/:version/publish
     * Publish an approved version for orchestrator consumption.
     */
    publish: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
      try {
        const { id, version: versionStr } = req.params;
        const versionNum = parseInt(versionStr, 10);
        if (isNaN(versionNum)) {
          throw badRequest('Invalid version number');
        }

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const version = storage.getVersion(id, versionNum);
        if (!version) {
          throw notFound('Version');
        }

        const check = canPublish(version.status);
        if (!check.valid) {
          throw badRequest(check.error!);
        }

        const updated = storage.updateVersionStatus(
          id,
          versionNum,
          PlanStatus.Published
        );
        if (!updated) {
          throw badRequest('Failed to publish version');
        }

        const planRef = generatePlanRef(id, versionNum);

        res.json({
          version: updated,
          plan_ref: planRef,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}
