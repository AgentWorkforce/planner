import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { createVersionFrom } from '../../domain/diff.js';
import { PlanStatus } from '../../domain/status.js';
import { notFound, badRequest } from '../middleware.js';
import {
  CreatePlanRequestSchema,
  UpdatePlanRequestSchema,
  ListPlansQuerySchema,
  CreateVersionRequestSchema,
} from '../schemas.js';

interface IdParams {
  id: string;
}

interface VersionParams extends IdParams {
  version: string;
}

/**
 * Creates plan route handlers with injected storage dependency.
 */
export function createPlanHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /plans
     * Create a new plan with initial draft version.
     */
    create: (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreatePlanRequestSchema.parse(req.body);

        // Create plan
        const plan = createPlan();
        storage.createPlan(plan);

        // Create initial draft version
        const version = createPlanVersion(plan.plan_id, body.goal, body.context);
        storage.createVersion(version);

        res.status(201).json({
          plan,
          version,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans
     * List all plans, optionally filtered by status.
     */
    list: (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListPlansQuerySchema.parse(req.query);
        const plans = storage.listPlans(query.status);
        res.json({ plans });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id
     * Get plan with its latest version.
     */
    get: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const latestVersion = storage.getLatestVersion(id);

        res.json({
          plan,
          version: latestVersion,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PUT /plans/:id
     * Update the draft version of a plan.
     */
    update: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const body = UpdatePlanRequestSchema.parse(req.body);

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const latestVersion = storage.getLatestVersion(id);
        if (!latestVersion) {
          throw notFound('Version');
        }

        if (latestVersion.status !== PlanStatus.Draft) {
          throw badRequest('Cannot update approved or published version');
        }

        // Create updated version (new version number)
        const newVersion = createVersionFrom(latestVersion);
        if (body.goal !== undefined) {
          newVersion.summary.goal = body.goal;
        }
        if (body.context !== undefined) {
          newVersion.summary.context = body.context;
        }
        if (body.steps !== undefined) {
          newVersion.steps = body.steps;
        }

        storage.createVersion(newVersion);

        res.json({
          plan,
          version: newVersion,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions
     * List all versions for a plan.
     */
    listVersions: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const versions = storage.listVersions(id);
        res.json({ versions });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions/:version
     * Get a specific version.
     */
    getVersion: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
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

        res.json({ version });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions
     * Create a new version based on the latest version.
     */
    createVersion: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const body = CreateVersionRequestSchema.parse(req.body);

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const latestVersion = storage.getLatestVersion(id);
        if (!latestVersion) {
          throw notFound('Version');
        }

        // Create new version from latest
        const newVersion = createVersionFrom(latestVersion);
        if (body.goal !== undefined) {
          newVersion.summary.goal = body.goal;
        }
        if (body.context !== undefined) {
          newVersion.summary.context = body.context;
        }
        if (body.steps !== undefined) {
          newVersion.steps = body.steps;
        }

        storage.createVersion(newVersion);

        res.status(201).json({ version: newVersion });
      } catch (err) {
        next(err);
      }
    },
  };
}
