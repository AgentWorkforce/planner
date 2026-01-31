import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage, Session } from '../../storage/interface.js';
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
import { isRelayAvailable } from '../../relay/service.js';
import { createSpawner, type SpawnResult } from '../../relay/spawner.js';
import { createMockSpawner } from '../../relay/mock-spawner.js';
import { createPlanChannel, joinChannel, getPlanChannelId } from '../../relay/channels.js';
import { notifyNewPlan } from '../../relay/planner-lead.js';
import { randomUUID } from 'crypto';

/** Default session expiration time (1 hour) */
const SESSION_EXPIRATION_MS = 60 * 60 * 1000;

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
 * Create a session record for an agent.
 */
function createAgentSession(planId: string, agentId: string, token: string): Session {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRATION_MS);

  return {
    session_id: randomUUID(),
    token,
    plan_id: planId,
    agent_id: agentId,
    status: 'active',
    started_at: now.toISOString(),
    ended_at: null,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  };
}

interface IdParams {
  id: string;
}

interface VersionParams extends IdParams {
  version: string;
}

// Get MCP server URL for agent connection
function getMcpServerUrl(): string {
  const port = process.env.PORT || 3001;
  const host = process.env.MCP_SERVER_HOST || `http://localhost:${port}`;
  return `${host}/api/mcp`;
}

/**
 * Creates plan route handlers with injected storage dependency.
 */
export function createPlanHandlers(storage: PlanStorage) {
  // Create spawner instances
  const realSpawner = createSpawner();
  const mockSpawner = createMockSpawner();

  return {
    /**
     * POST /plans
     * Create a new plan with initial draft version.
     * If ai_assist=true, spawns a planning agent.
     */
    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreatePlanRequestSchema.parse(req.body);

        // Get default org for MVP single-org mode
        const orgId = getDefaultOrgId(storage);

        // Create plan with org and optional initiative association
        const plan = createPlan(orgId);
        if (body.initiative_id) {
          plan.initiative_id = body.initiative_id;
        }
        storage.createPlan(plan);

        // Create initial draft version
        const version = createPlanVersion(plan.plan_id, body.goal, body.context);
        storage.createVersion(version);

        // Create plan channel for relay communication
        const channelId = createPlanChannel(plan.plan_id, body.goal);
        if (channelId) {
          console.log(`[plans] Created channel ${channelId} for plan ${plan.plan_id}`);
          // Notify PlannerLead of the new plan (fire-and-forget, don't block API response)
          notifyNewPlan(channelId, plan.plan_id, body.goal, body.context).catch((err) => {
            console.error('[plans] Failed to notify PlannerLead:', err);
          });
        }

        // Spawn planning agent if AI assistance requested
        let agent: SpawnResult | null = null;
        let session: Session | null = null;
        if (body.ai_assist) {
          const spawner = isRelayAvailable() ? realSpawner : mockSpawner;
          try {
            agent = await spawner.spawn({
              planId: plan.plan_id,
              goal: body.goal,
              context: body.context,
              mcpServerUrl: getMcpServerUrl(),
            });
            console.log(`[plans] Spawned agent ${agent.agentId} for plan ${plan.plan_id}`);

            // Create session record for agent authentication
            session = createAgentSession(plan.plan_id, agent.agentId, agent.sessionToken);
            storage.createSession(session);
            console.log(`[plans] Created session ${session.session_id} for agent ${agent.agentId}`);
          } catch (err) {
            // Log spawn error but don't fail plan creation
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[plans] Failed to spawn agent for plan ${plan.plan_id}: ${message}`);
          }
        }

        res.status(201).json({
          plan,
          version,
          agent: agent && session
            ? { agent_id: agent.agentId, session_id: session.session_id, token: session.token, is_mock: agent.isMock }
            : undefined,
        });
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

            // Navigation fields
            const stepCount = latestVersion?.steps?.length ?? 0;
            const pendingQuestions = storage.listQuestionsByPlan(plan.plan_id, 'pending');
            const session = storage.getSessionByPlanId(plan.plan_id);
            const agentActive = session !== null && session.status === 'active';

            return {
              plan_id: plan.plan_id,
              goal: latestVersion?.summary?.goal || '',
              context: latestVersion?.summary?.context,
              status: latestVersion?.status || PlanStatus.Draft,
              latest_version: latestVersion?.version || 1,
              scopes,
              initiative_id: plan.initiative_id,
              initiative,
              created_at: plan.created_at,
              updated_at: plan.updated_at,
              // Navigation fields
              step_count: stepCount,
              completed_step_count: 0, // No execution data in non-attention flow
              pending_questions: pendingQuestions.length,
              agent_active: agentActive,
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

          // Navigation fields
          const stepCount = latestVersion?.steps?.length ?? 0;
          // Note: completed_step_count requires full orchestrator integration
          // For now, default to 0 until orchestrator provides step progress data
          const completedStepCount = 0;
          const pendingQuestions = storage.listQuestionsByPlan(plan.plan_id, 'pending');
          const session = storage.getSessionByPlanId(plan.plan_id);
          const agentActive = session !== null && session.status === 'active';

          return {
            plan_id: plan.plan_id,
            goal: latestVersion?.summary?.goal || '',
            context: latestVersion?.summary?.context,
            status: latestVersion?.status || PlanStatus.Draft,
            latest_version: latestVersion?.version || 1,
            scopes,
            initiative_id: plan.initiative_id,
            initiative,
            created_at: plan.created_at,
            updated_at: plan.updated_at,
            attention_types: attentionTypes,
            // Navigation fields
            step_count: stepCount,
            completed_step_count: completedStepCount,
            pending_questions: pendingQuestions.length,
            agent_active: agentActive,
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

        // Auto-join user to plan channel
        const channelId = getPlanChannelId(id);
        joinChannel(channelId, 'user');

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
        const hasVersionUpdates = body.goal !== undefined || body.context !== undefined || body.steps !== undefined;

        if (hasVersionUpdates) {
          // Version updates require draft status
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
            plan: updatedPlan,
            version: newVersion,
          });
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
