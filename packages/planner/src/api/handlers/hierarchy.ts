import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound } from '../middleware.js';

interface PlanIdParams {
  id: string;
}

/**
 * Creates handlers for sub-plan hierarchy queries.
 */
export function createHierarchyHandlers(storage: PlanStorage) {
  return {
    /**
     * GET /plans/:id/sub-plans
     * Returns all plans referenced as sub_plan_id in this plan's latest version steps.
     * Includes each sub-plan's current status from its latest version.
     */
    listSubPlans: (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      try {
        const { id: planId } = req.params;

        const plan = storage.getPlan(planId);
        if (!plan) throw notFound('Plan');

        const subPlanIds = storage.getSubPlanIds(planId);

        const subPlans = subPlanIds.map(subId => {
          const subPlan = storage.getPlan(subId);
          const latestVersion = storage.getLatestVersion(subId);
          return {
            plan_id: subId,
            goal: latestVersion?.summary?.goal ?? null,
            status: latestVersion?.status ?? null,
            version: latestVersion?.version ?? null,
            step_count: latestVersion?.steps?.length ?? 0,
            updated_at: subPlan?.updated_at ?? null,
          };
        });

        res.json({ plan_id: planId, sub_plans: subPlans });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/dependents
     * Returns all plans that reference this plan as a sub_plan_id in their steps.
     * These are the "parent" plans that depend on this plan.
     */
    /**
     * GET /plans/:id/resolved
     * Returns the plan with sub-plan steps expanded inline, preserving original step order.
     * Sub-plan steps are replaced with their child plan's steps grouped under a section.
     * One level deep only.
     */
    getResolved: (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      try {
        const { id: planId } = req.params;

        const plan = storage.getPlan(planId);
        if (!plan) throw notFound('Plan');

        const latestVersion = storage.getLatestVersion(planId);
        if (!latestVersion) {
          res.json({ plan, version: null, resolved_steps: [] });
          return;
        }

        // Walk steps in order, resolving sub_plan_id references
        const resolvedSteps = latestVersion.steps.map((step) => {
          if (!step.sub_plan_id) {
            return { type: 'step' as const, step };
          }

          // Resolve the sub-plan
          const subPlanVersion = storage.getLatestVersion(step.sub_plan_id);
          const subPlan = storage.getPlan(step.sub_plan_id);

          return {
            type: 'sub_plan' as const,
            parent_step: step,
            sub_plan: {
              plan_id: step.sub_plan_id,
              goal: subPlanVersion?.summary?.goal ?? subPlan?.plan_id ?? '',
              status: subPlanVersion?.status ?? null,
              version: subPlanVersion?.version ?? null,
              steps: subPlanVersion?.steps ?? [],
            },
          };
        });

        res.json({ plan, version: latestVersion, resolved_steps: resolvedSteps });
      } catch (err) {
        next(err);
      }
    },

    listDependents: (req: Request<PlanIdParams>, res: Response, next: NextFunction) => {
      try {
        const { id: planId } = req.params;

        const plan = storage.getPlan(planId);
        if (!plan) throw notFound('Plan');

        const dependentPlanIds = storage.getDependentPlanIds(planId);

        const dependents = dependentPlanIds.map(depId => {
          const depPlan = storage.getPlan(depId);
          const latestVersion = storage.getLatestVersion(depId);
          return {
            plan_id: depId,
            goal: latestVersion?.summary?.goal ?? null,
            status: latestVersion?.status ?? null,
            version: latestVersion?.version ?? null,
            updated_at: depPlan?.updated_at ?? null,
          };
        });

        res.json({ plan_id: planId, dependents });
      } catch (err) {
        next(err);
      }
    },
  };
}
