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
     * POST /api/projects/:id/graduate - Graduate project to next phase
     */
    graduate: async (req: Request<IdParams>, res: Response, next: NextFunction) => {
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
        const now = new Date().toISOString();

        // Handle graduation to ideation (onboarding → ideation)
        if (target === 'ideation') {
          // Check if already has session
          if (existing.session_id) {
            throw conflict('Project already has an ideation session');
          }

          // Create ideation session via HTTP call to ideation service
          try {
            const ideationUrl = process.env.IDEATION_URL || `http://localhost:${process.env.PORT || 3001}/api/ideation`;
            const sessionResponse = await fetch(`${ideationUrl}/sessions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                initial_intent: existing.name,
                initiative_id: existing.initiative_id || undefined,
              }),
            });

            if (!sessionResponse.ok) {
              const errorText = await sessionResponse.text();
              throw new Error(`Failed to create ideation session: ${errorText}`);
            }

            const sessionData = await sessionResponse.json() as { id: string };

            // Use transaction to update project with session_id
            const result = storage.transaction(() => {
              const updated = storage.updateProject(req.params.id, {
                session_id: sessionData.id
              });

              if (!updated) {
                throw notFound('Project');
              }

              return {
                project: updated,
                session_id: sessionData.id
              };
            });

            console.log(`Project ${existing.id} graduated to ideation session ${result.session_id}`);

            res.json(result);
            return;
          } catch (error) {
            if (error instanceof Error) {
              throw badRequest(`Failed to create ideation session: ${error.message}`);
            }
            throw error;
          }
        }

        // Handle graduation to planning (ideation → planning)
        if (target === 'planning') {
          // Check if already has plan
          if (existing.plan_id) {
            throw conflict('Project already has a plan');
          }

          // Require session_id for planning graduation
          if (!existing.session_id) {
            throw badRequest('Project must have a session to graduate to planning');
          }

          // Fetch and convert blocks if block_ids provided
          let convertedSteps: Array<{
            step_id: string;
            title: string;
            scope?: string;
            description?: string;
            dependencies: string[];
            owner_role?: string;
          }> = [];

          const blockIds = options?.block_ids as string[] | undefined;
          if (blockIds && blockIds.length > 0) {
            try {
              const ideationUrl = process.env.IDEATION_URL || `http://localhost:${process.env.PORT || 3001}/api/ideation`;
              const blocksResponse = await fetch(`${ideationUrl}/sessions/${existing.session_id}/blocks`);

              if (blocksResponse.ok) {
                const allBlocks = await blocksResponse.json() as Array<{
                  id: string;
                  title: string;
                  type: string;
                  content: string;
                  specialist: string;
                }>;

                const selectedBlocks = allBlocks.filter(b => blockIds.includes(b.id));

                convertedSteps = selectedBlocks.map(block => ({
                  step_id: randomUUID(),
                  title: block.title,
                  scope: block.type !== 'feature' ? block.type : undefined,
                  description: block.content,
                  dependencies: [],
                  owner_role: block.specialist || undefined,
                }));
              }
            } catch (fetchError) {
              console.warn('Failed to fetch blocks for graduation, proceeding with empty steps:', fetchError);
            }
          }

          // Use transaction for atomicity
          const result = storage.transaction(() => {
            // Create a new plan for this project
            const newPlan = {
              plan_id: randomUUID(),
              org_id: 'default',
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
              steps: convertedSteps,
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

          console.log(`Project ${existing.id} graduated to planning ${result.plan_id}`);

          res.json(result);
          return;
        }

        // Handle graduation to forging (planning → forging)
        if (target === 'forging') {
          // Check if already has run
          if (existing.run_id) {
            throw conflict('Project already has a forge run');
          }

          // Require plan_id for forging graduation
          if (!existing.plan_id) {
            throw badRequest('Project must have a plan to graduate to forging');
          }

          // Use transaction for atomicity
          const result = storage.transaction(() => {
            // Create a forge run (stub for now - just generate run_id)
            // The forge service will handle the actual run creation
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

          console.log(`Project ${existing.id} graduated to forging ${result.run_id}`);

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
