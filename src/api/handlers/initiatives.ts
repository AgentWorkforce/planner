import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { createInitiative } from '../../domain/organization.js';
import { notFound, badRequest } from '../middleware.js';
import { z } from 'zod';

/** Default organization slug for MVP (single-org mode) */
const DEFAULT_ORG_SLUG = 'default';

/**
 * Get the default org_id from storage.
 * In MVP single-org mode, we use the 'default' organization.
 */
function getDefaultOrgId(storage: PlanStorage): string {
  const orgs = storage.listOrganizations();
  const defaultOrg = orgs.find((o) => o.slug === DEFAULT_ORG_SLUG);
  if (!defaultOrg) {
    throw new Error('Default organization not found');
  }
  return defaultOrg.org_id;
}

/**
 * Request schema for creating an initiative
 */
const CreateInitiativeRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  display_order: z.number().int().nonnegative().optional(),
});

/**
 * Request schema for updating an initiative
 */
const UpdateInitiativeRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  display_order: z.number().int().nonnegative().optional(),
});

interface IdParams {
  id: string;
}

/**
 * Creates initiative route handlers with injected storage dependency.
 */
export function createInitiativeHandlers(storage: PlanStorage) {
  return {
    /**
     * GET /api/initiatives - List all initiatives for the default organization
     * Returns initiatives with aggregated plan counts by status.
     */
    list: (_req: Request, res: Response, next: NextFunction) => {
      try {
        const orgId = getDefaultOrgId(storage);
        const initiatives = storage.listInitiatives(orgId);

        // Compute plan counts for each initiative
        const initiativesWithCounts = initiatives.map((initiative) => {
          const plans = storage.listPlans({ initiative_id: initiative.initiative_id });

          // Get latest version status for each plan
          const planStatuses = plans.map((plan) => {
            const latestVersion = storage.getLatestVersion(plan.plan_id);
            return latestVersion?.status || 'draft';
          });

          const planCounts = {
            total: plans.length,
            draft: planStatuses.filter((s) => s === 'draft').length,
            approved: planStatuses.filter((s) => s === 'approved').length,
            published: planStatuses.filter((s) => s === 'published').length,
          };

          return {
            ...initiative,
            plan_counts: planCounts,
          };
        });

        res.json({ initiatives: initiativesWithCounts });
      } catch (error) {
        next(error);
      }
    },

    /**
     * GET /api/initiatives/:id - Get a specific initiative
     */
    get: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const initiative = storage.getInitiative(req.params.id);
        if (!initiative) {
          throw notFound('Initiative');
        }
        res.json(initiative);
      } catch (error) {
        next(error);
      }
    },

    /**
     * POST /api/initiatives - Create a new initiative
     */
    create: (req: Request, res: Response, next: NextFunction) => {
      try {
        const parseResult = CreateInitiativeRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
        }

        const orgId = getDefaultOrgId(storage);
        const { name, description, icon, color, display_order } = parseResult.data;

        const initiative = createInitiative(orgId, name, {
          description,
          icon,
          color,
          display_order: display_order ?? 0,
        });

        const created = storage.createInitiative(initiative);
        res.status(201).json(created);
      } catch (error) {
        next(error);
      }
    },

    /**
     * PUT /api/initiatives/:id - Update an initiative
     */
    update: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const parseResult = UpdateInitiativeRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
        }

        const existing = storage.getInitiative(req.params.id);
        if (!existing) {
          throw notFound('Initiative');
        }

        const updates = parseResult.data;
        const updated = storage.updateInitiative(req.params.id, updates);

        if (!updated) {
          throw notFound('Initiative');
        }

        res.json(updated);
      } catch (error) {
        next(error);
      }
    },

    /**
     * DELETE /api/initiatives/:id - Delete an initiative
     */
    delete: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const existing = storage.getInitiative(req.params.id);
        if (!existing) {
          throw notFound('Initiative');
        }

        const deleted = storage.deleteInitiative(req.params.id);
        if (!deleted) {
          throw notFound('Initiative');
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  };
}
