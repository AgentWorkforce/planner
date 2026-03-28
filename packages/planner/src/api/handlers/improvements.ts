import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound, badRequest } from '../middleware.js';

interface VersionParams {
  id: string;
  version: string;
}

interface ImprovementParams extends VersionParams {
  improvementId: string;
}

/**
 * Get session status for a plan.
 * Returns 'active' if planning session exists, 'none' otherwise.
 */
function getSessionStatus(storage: PlanStorage, planId: string): 'active' | 'none' {
  const session = storage.getSessionByPlanId(planId);
  return session ? 'active' : 'none';
}

/**
 * Creates improvement route handlers with injected storage dependency.
 */
export function createImprovementHandlers(storage: PlanStorage) {
  return {
    /**
     * GET /plans/:id/versions/:version/improvements
     * List all improvements for a plan version.
     */
    list: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
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

        const improvements = storage.listImprovementsByVersion(id, versionNum);
        const session_status = getSessionStatus(storage, id);
        res.json({ improvements, session_status });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions/:version/improvements/pending
     * List pending improvements for a plan version.
     */
    listPending: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
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

        const improvements = storage.listPendingImprovements(id, versionNum);
        const session_status = getSessionStatus(storage, id);
        res.json({ improvements, session_status });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions/:version/improvements/:improvementId
     * Get a specific improvement.
     */
    get: (req: Request<ImprovementParams>, res: Response, next: NextFunction) => {
      try {
        const { id, improvementId } = req.params;

        const improvement = storage.getImprovement(improvementId);
        if (!improvement) {
          throw notFound('Improvement');
        }

        const session_status = getSessionStatus(storage, id);
        res.json({ improvement, session_status });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions/:version/improvements/:improvementId/accept
     * Accept an improvement and mark it as accepted.
     */
    accept: (req: Request<ImprovementParams>, res: Response, next: NextFunction) => {
      try {
        const { id, improvementId } = req.params;

        const improvement = storage.getImprovement(improvementId);
        if (!improvement) {
          throw notFound('Improvement');
        }

        if (improvement.status !== 'pending') {
          throw badRequest('Improvement is not pending');
        }

        const updated = storage.updateImprovementStatus(improvementId, 'accepted');
        if (!updated) {
          throw badRequest('Failed to accept improvement');
        }

        const session_status = getSessionStatus(storage, id);
        res.json({ improvement: updated, session_status });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions/:version/improvements/:improvementId/dismiss
     * Dismiss an improvement.
     */
    dismiss: (req: Request<ImprovementParams>, res: Response, next: NextFunction) => {
      try {
        const { id, improvementId } = req.params;

        const improvement = storage.getImprovement(improvementId);
        if (!improvement) {
          throw notFound('Improvement');
        }

        if (improvement.status !== 'pending') {
          throw badRequest('Improvement is not pending');
        }

        const updated = storage.updateImprovementStatus(improvementId, 'dismissed');
        if (!updated) {
          throw badRequest('Failed to dismiss improvement');
        }

        const session_status = getSessionStatus(storage, id);
        res.json({ improvement: updated, session_status });
      } catch (err) {
        next(err);
      }
    },
  };
}
