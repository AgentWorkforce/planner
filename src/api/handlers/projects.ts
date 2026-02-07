import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound, badRequest, conflict } from '../middleware.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  UpdateProjectFocusSchema,
  ListProjectsQuerySchema,
  GraduateProjectRequestSchema,
  CreatePlanRequestSchema,
} from '../schemas.js';
import { randomUUID } from 'node:crypto';

interface IdParams {
  id: string;
}

/**
 * Creates project route handlers with injected storage dependency.
 */
export function createProjectHandlers(storage: PlanStorage) {
  return {
    /**
     * GET /api/projects - List all projects
     * Query params: ?owner_id=...&initiative_id=...
     */
    list: (req: Request, res: Response, next: NextFunction) => {
      try {
        const parseResult = ListProjectsQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid query parameters');
        }

        const filter = parseResult.data;
        const projects = storage.listProjects(filter);

        res.json({ projects });
      } catch (error) {
        next(error);
      }
    },

    /**
     * POST /api/projects - Create new project
     */
    create: (req: Request, res: Response, next: NextFunction) => {
      try {
        const parseResult = CreateProjectRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
        }

        const { name, owner_id, initiative_id, config } = parseResult.data;
        const now = new Date().toISOString();

        const project = {
          id: randomUUID(),
          name,
          owner_id: owner_id ?? null,
          initiative_id: initiative_id ?? null,
          session_id: null,
          plan_id: null,
          run_id: null,
          config: config ?? null,
          current_focus: null,
          created_at: now,
          updated_at: now,
        };

        const created = storage.createProject(project);
        res.status(201).json({ project: created });
      } catch (error) {
        next(error);
      }
    },

    /**
     * GET /api/projects/:id - Get single project
     */
    get: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const project = storage.getProject(req.params.id);
        if (!project) {
          throw notFound('Project');
        }
        res.json({ project });
      } catch (error) {
        next(error);
      }
    },

    /**
     * PUT /api/projects/:id - Update project fields
     */
    update: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const parseResult = UpdateProjectRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
        }

        const existing = storage.getProject(req.params.id);
        if (!existing) {
          throw notFound('Project');
        }

        const updates = parseResult.data;
        const updated = storage.updateProject(req.params.id, updates);

        if (!updated) {
          throw notFound('Project');
        }

        res.json({ project: updated });
      } catch (error) {
        next(error);
      }
    },

    /**
     * POST /api/projects/:id/focus - Update current focus
     */
    updateFocus: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const parseResult = UpdateProjectFocusSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
        }

        const existing = storage.getProject(req.params.id);
        if (!existing) {
          throw notFound('Project');
        }

        const { current_focus } = parseResult.data;
        const updated = storage.updateProjectFocus(req.params.id, current_focus);

        if (!updated) {
          throw notFound('Project');
        }

        res.json({ project: updated });
      } catch (error) {
        next(error);
      }
    },

    /**
     * POST /api/projects/:id/graduate - Graduate project to plan or forge
     */
    graduate: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const existing = storage.getProject(req.params.id);
        if (!existing) {
          throw notFound('Project');
        }

        const parseResult = GraduateProjectRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          throw badRequest(parseResult.error.errors[0]?.message || 'Invalid request body');
        }

        const { target, options } = parseResult.data;

        // Handle graduation to plan
        if (target === 'plan') {
          // Check if already graduated to plan
          if (existing.plan_id) {
            throw conflict('Project has already been graduated to a plan');
          }

          // Require session_id for plan graduation
          if (!existing.session_id) {
            throw badRequest('Project must have a session_id to graduate to a plan');
          }

          const now = new Date().toISOString();

          // Use a transaction to ensure atomicity
          const result = storage.transaction(() => {
            // Create a new plan for this project
            const newPlan = {
              plan_id: randomUUID(),
              org_id: 'default', // Use default org for now
              owner_user_id: existing.owner_id ?? undefined,
              initiative_id: existing.initiative_id ?? undefined,
              created_at: now,
              updated_at: now,
            };

            const createdPlan = storage.createPlan(newPlan);

            // Create initial version for the plan
            const initialVersion = {
              plan_id: createdPlan.plan_id,
              version: 1,
              status: 'draft' as const,
              summary: {
                goal: existing.name,
                context: 'Graduated from ideation session',
              },
              steps: [],
              created_at: now,
              updated_at: now,
            };

            storage.createVersion(initialVersion);

            // Update project with plan_id
            const updated = storage.updateProject(req.params.id, {
              plan_id: createdPlan.plan_id
            });

            if (!updated) {
              throw notFound('Project');
            }

            return {
              project: updated,
              plan_id: createdPlan.plan_id
            };
          });

          // TODO: Emit SSE event for 'project:graduated' to notify frontend
          // Example: emitProjectEvent(existing.id, 'graduated', { target: 'plan', plan_id: result.plan_id });
          console.log(`Project ${existing.id} graduated to plan ${result.plan_id}`);

          res.json(result);
          return;
        }

        // Handle graduation to forge
        if (target === 'forge') {
          // Check if already graduated to forge
          if (existing.run_id) {
            throw conflict('Project has already been graduated to a forge run');
          }

          // Require plan_id for forge graduation
          if (!existing.plan_id) {
            throw badRequest('Project must have a plan_id to graduate to forge');
          }

          // Use a transaction to ensure atomicity
          const result = storage.transaction(() => {
            // Create a forge run (stub for now - just generate run_id)
            const runId = randomUUID();

            // Update project with run_id
            const updated = storage.updateProject(req.params.id, {
              run_id: runId
            });

            if (!updated) {
              throw notFound('Project');
            }

            return {
              project: updated,
              run_id: runId
            };
          });

          // TODO: Emit SSE event for 'project:graduated' to notify frontend
          // Example: emitProjectEvent(existing.id, 'graduated', { target: 'forge', run_id: result.run_id });
          console.log(`Project ${existing.id} graduated to forge run ${result.run_id}`);

          res.json(result);
          return;
        }

        throw badRequest('Invalid graduation target');
      } catch (error) {
        next(error);
      }
    },
  };
}
