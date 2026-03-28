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
import {
  validatePlanDOTSync,
  mergeValidationIntoResponse,
} from '../middleware/dot-validation.js';
import { summarizeComplexity } from '../../services/complexity-estimator.js';
import {
  validateSubPlanReferences,
  validateSubPlansPublished,
} from '../../services/limits-enforcer.js';

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
 * Standalone version - no agent termination on approval.
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
    approve: async (req: Request<VersionParams>, res: Response, next: NextFunction) => {
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

        // Validate sub-plan references exist (hard error if missing)
        const refCheck = validateSubPlanReferences(version, storage);
        if (!refCheck.valid) {
          throw badRequest(`Sub-plan validation failed: ${refCheck.errors.join('; ')}`);
        }

        const approvalInfo = {
          approver: body.approver,
          approved_at: new Date().toISOString(),
        };

        const updated = storage.approveVersion(id, versionNum, approvalInfo);
        if (!updated) {
          throw badRequest('Failed to approve version');
        }

        // Mark any active session as completed
        const session = storage.getSessionByPlanId(id);
        if (session) {
          storage.updateSessionStatus(session.session_id, 'completed');
          console.log(`[workflow] Session ${session.session_id} completed on plan approval (standalone mode)`);
        }

        // Include sub-plan warnings in response (e.g., unapproved sub-plans)
        const response: Record<string, unknown> = { version: updated };
        if (refCheck.warnings.length > 0) {
          response.sub_plan_warnings = refCheck.warnings;
        }

        res.json(response);
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

        // Hard block: all referenced sub-plans must be published
        const subPlanCheck = validateSubPlansPublished(version, storage);
        if (!subPlanCheck.valid) {
          throw badRequest(`Cannot publish: ${subPlanCheck.errors.join('; ')}`);
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

        // DOT Framework: Validate and log warnings at publish time
        const validation = validatePlanDOTSync(updated);
        if (validation.warnings.length > 0) {
          console.log(`[workflow] Publishing plan ${id} v${versionNum} with DOT warnings:`, validation.warnings);
        }

        // DOT Framework: Include complexity summary for Forge/Tuner consumption
        const complexitySummary = summarizeComplexity(updated.steps);

        const response = {
          version: updated,
          plan_ref: planRef,
          // DOT Framework: Include complexity summary for orchestrator
          dot_summary: {
            total_steps: complexitySummary.totalSteps,
            complexity_distribution: complexitySummary.byLevel,
            average_complexity: complexitySummary.averageScore,
            max_complexity: complexitySummary.maxScore,
            steps_requiring_decomposition: complexitySummary.stepsRequiringDecomposition.length,
            steps_considering_decomposition: complexitySummary.stepsConsideringDecomposition.length,
          },
        };

        res.json(mergeValidationIntoResponse(response, validation));
      } catch (err) {
        next(err);
      }
    },
  };
}
