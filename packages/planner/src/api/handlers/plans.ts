import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { createPlan, createPlanVersion } from '../../domain/plan.js';
import { createVersionFrom } from '../../domain/diff.js';
import { PlanStatus } from '../../domain/status.js';
import type { AttentionType } from '../../domain/attention.js';
import { computeAttentionTypes, type AttentionInput } from '../../domain/compute-attention.js';
import { getExecutionStatusBatch } from '../../orchestrator/client.js';
import { notFound, badRequest } from '../middleware.js';
import {
  CreatePlanRequestSchema,
  UpdatePlanRequestSchema,
  ListPlansQuerySchema,
  CreateVersionRequestSchema,
} from '../schemas.js';
import {
  enrichPlanVersionForCreate,
  enrichPlanVersionForUpdate,
} from '../middleware/dot-enrichment.js';
import {
  validatePlanDOTSync,
  mergeValidationIntoResponse,
} from '../middleware/dot-validation.js';

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

interface IdParams {
  id: string;
}

interface VersionParams extends IdParams {
  version: string;
}

/**
 * Creates plan route handlers with injected storage dependency.
 * Standalone version - no agent spawning or relay integration.
 */
export function createPlanHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /plans
     * Create a new plan with initial draft version.
     * In standalone mode, ai_assist is ignored (no agent spawning).
     */
    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreatePlanRequestSchema.parse(req.body);

        // Get default org for MVP single-org mode
        const orgId = getDefaultOrgId(storage);

        // Create plan with org, optional initiative, and optional source
        const plan = createPlan(orgId, undefined, body.source);
        if (body.initiative_id) {
          plan.initiative_id = body.initiative_id;
        }
        storage.createPlan(plan);

        // Create initial draft version with optional understanding and decomposition config
        let version = createPlanVersion(plan.plan_id, body.goal, {
          context: body.context,
          understanding: body.understanding,
          decomposition_config: body.decomposition_config,
        });

        // DOT Framework: Enrich steps with language tier and complexity estimate
        version = enrichPlanVersionForCreate(version);

        // DOT Framework: Validate and collect warnings
        const validation = validatePlanDOTSync(version);

        storage.createVersion(version);

        // Log if AI assist was requested but not available
        if (body.ai_assist) {
          console.log(`[plans] AI assist requested for plan ${plan.plan_id} but running in standalone mode`);
        }

        const response = {
          plan,
          version,
          // No agent in standalone mode
          agent: undefined,
        };

        res.status(201).json(mergeValidationIntoResponse(response, validation));
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans
     * List all plans, optionally filtered by status.
     * Returns PlanSummary objects with goal, status, and latest_version.
     * When include_attention=true, includes attention_types array for each plan.
     */
    list: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListPlansQuerySchema.parse(req.query);

        // Build filter from query params
        const filter: { status?: PlanStatus; initiative_id?: string } = {};
        if (query.status) {
          filter.status = query.status;
        }
        if (query.initiative_id) {
          filter.initiative_id = query.initiative_id;
        }

        // Standard flow without attention data
        if (!query.include_attention) {
          const plans = storage.listPlans(filter);
          const planSummaries = plans.map((plan) => {
            const latestVersion = storage.getLatestVersion(plan.plan_id);
            const scopes = latestVersion?.steps
              ? [...new Set(latestVersion.steps.map((s) => s.scope).filter(Boolean))]
              : [];

            // Include initiative data if plan has initiative_id
            let initiative = undefined;
            if (plan.initiative_id) {
              const init = storage.getInitiative(plan.initiative_id);
              if (init) {
                initiative = {
                  initiative_id: init.initiative_id,
                  name: init.name,
                  icon: init.icon,
                  color: init.color,
                };
              }
            }

            return {
              plan_id: plan.plan_id,
              goal: latestVersion?.summary?.goal || '',
              status: latestVersion?.status || PlanStatus.Draft,
              latest_version: latestVersion?.version || 1,
              scopes,
              initiative_id: plan.initiative_id,
              initiative,
              created_at: plan.created_at,
              updated_at: plan.updated_at,
            };
          });
          res.json({ plans: planSummaries });
          return;
        }

        // Enhanced flow with attention data
        const plansWithData = storage.listPlansWithAttention(filter);
        const planIds = plansWithData.map((p) => p.plan.plan_id);

        // Fetch execution status from orchestrator (graceful degradation)
        const executionStatusMap = await getExecutionStatusBatch(planIds);

        // Compute attention types for each plan
        const planSummaries = plansWithData.map((data) => {
          const { plan, latestVersion, pendingChangeRequestCount, unresolvedCommentCount } = data;

          // Build attention input
          const attentionInput: AttentionInput = {
            plan,
            latestVersion,
            pendingChangeRequests: pendingChangeRequestCount,
            executionStatus: executionStatusMap.get(plan.plan_id) ?? null,
            unresolvedCommentCount,
          };

          const attentionTypes: AttentionType[] = computeAttentionTypes(attentionInput);

          // Extract unique scopes from steps
          const scopes = latestVersion?.steps
            ? [...new Set(latestVersion.steps.map((s) => s.scope).filter(Boolean))]
            : [];

          // Include initiative data if plan has initiative_id
          let initiative = undefined;
          if (plan.initiative_id) {
            const init = storage.getInitiative(plan.initiative_id);
            if (init) {
              initiative = {
                initiative_id: init.initiative_id,
                name: init.name,
                icon: init.icon,
                color: init.color,
              };
            }
          }

          return {
            plan_id: plan.plan_id,
            goal: latestVersion?.summary?.goal || '',
            status: latestVersion?.status || PlanStatus.Draft,
            latest_version: latestVersion?.version || 1,
            scopes,
            initiative_id: plan.initiative_id,
            initiative,
            created_at: plan.created_at,
            updated_at: plan.updated_at,
            attention_types: attentionTypes,
          };
        });

        res.json({ plans: planSummaries });
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
     * Update plan metadata (initiative_id) and/or draft version content.
     * - initiative_id can be updated regardless of version status
     * - goal, context, steps require draft status
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

        // Update initiative_id if provided (plan-level, allowed regardless of version status)
        let updatedPlan = plan;
        if (body.initiative_id !== undefined) {
          const result = storage.updatePlan(id, { initiative_id: body.initiative_id });
          if (!result) {
            throw notFound('Plan');
          }
          updatedPlan = result;
        }

        // Check if there are version-level updates
        const hasVersionUpdates = body.goal !== undefined || body.context !== undefined || body.steps !== undefined || body.decomposition_config !== undefined;

        if (hasVersionUpdates) {
          // Version updates require draft status
          if (latestVersion.status !== PlanStatus.Draft) {
            throw badRequest('Cannot update approved or published version');
          }

          // Create updated version (new version number)
          let newVersion = createVersionFrom(latestVersion);
          if (body.goal !== undefined) {
            newVersion.summary.goal = body.goal;
          }
          if (body.context !== undefined) {
            newVersion.summary.context = body.context;
          }
          if (body.steps !== undefined) {
            newVersion.steps = body.steps;
          }
          if (body.decomposition_config !== undefined) {
            newVersion.decomposition_config = body.decomposition_config;
          }

          // DOT Framework: Enrich new/modified steps with language tier and complexity estimate
          newVersion = enrichPlanVersionForUpdate(newVersion, latestVersion.steps);

          // DOT Framework: Validate and collect warnings
          const validation = validatePlanDOTSync(newVersion);

          // Check for validation errors (block save if errors)
          if (!validation.valid) {
            throw badRequest(`DOT validation failed: ${validation.errors.join('; ')}`);
          }

          storage.createVersion(newVersion);

          res.json(mergeValidationIntoResponse({
            plan: updatedPlan,
            version: newVersion,
          }, validation));
        } else {
          // Only plan-level updates, return existing version
          res.json({
            plan: updatedPlan,
            version: latestVersion,
          });
        }
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
        let newVersion = createVersionFrom(latestVersion);
        if (body.goal !== undefined) {
          newVersion.summary.goal = body.goal;
        }
        if (body.context !== undefined) {
          newVersion.summary.context = body.context;
        }
        if (body.steps !== undefined) {
          newVersion.steps = body.steps;
        }
        if (body.decomposition_config !== undefined) {
          newVersion.decomposition_config = body.decomposition_config;
        }

        // DOT Framework: Enrich new/modified steps
        newVersion = enrichPlanVersionForUpdate(newVersion, latestVersion.steps);

        // DOT Framework: Validate
        const validation = validatePlanDOTSync(newVersion);
        if (!validation.valid) {
          throw badRequest(`DOT validation failed: ${validation.errors.join('; ')}`);
        }

        storage.createVersion(newVersion);

        res.status(201).json(mergeValidationIntoResponse({ version: newVersion }, validation));
      } catch (err) {
        next(err);
      }
    },
  };
}
