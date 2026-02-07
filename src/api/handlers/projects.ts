import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound, badRequest } from '../middleware.js';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  UpdateProjectFocusSchema,
  ListProjectsQuerySchema,
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
     * POST /api/projects/:id/graduate - Stub for graduation bridge
     */
    graduate: (req: Request<IdParams>, res: Response, next: NextFunction) => {
      try {
        const existing = storage.getProject(req.params.id);
        if (!existing) {
          throw notFound('Project');
        }

        // TODO: Implement graduation logic
        // This will bridge from ideation → planning → execution
        res.status(501).json({ message: 'Not implemented yet' });
      } catch (error) {
        next(error);
      }
    },
  };
}
