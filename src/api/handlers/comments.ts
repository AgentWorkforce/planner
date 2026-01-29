import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { createComment } from '../../domain/comment.js';
import { notFound, badRequest } from '../middleware.js';
import {
  CreateCommentRequestSchema,
  UpdateCommentRequestSchema,
  ResolveCommentRequestSchema,
} from '../schemas.js';

interface VersionParams {
  id: string;
  version: string;
}

interface CommentParams extends VersionParams {
  commentId: string;
}

interface StepParams extends VersionParams {
  stepId: string;
}

/**
 * Creates comment route handlers with injected storage dependency.
 */
export function createCommentHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /plans/:id/versions/:version/comments
     * Create a new comment on a step.
     */
    create: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
      try {
        const { id, version: versionStr } = req.params;
        const versionNum = parseInt(versionStr, 10);
        if (isNaN(versionNum)) {
          throw badRequest('Invalid version number');
        }

        const body = CreateCommentRequestSchema.parse(req.body);

        // Verify plan and version exist
        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const version = storage.getVersion(id, versionNum);
        if (!version) {
          throw notFound('Version');
        }

        // Verify step exists in version
        const stepExists = version.steps.some((s) => s.step_id === body.step_id);
        if (!stepExists) {
          throw notFound('Step');
        }

        // If parent_id provided, verify parent comment exists
        if (body.parent_id) {
          const parentComment = storage.getComment(body.parent_id);
          if (!parentComment) {
            throw notFound('Parent comment');
          }
          // Parent must be on the same step
          if (parentComment.step_id !== body.step_id) {
            throw badRequest('Parent comment must be on the same step');
          }
        }

        const comment = createComment(
          id,
          versionNum,
          body.step_id,
          body.author,
          body.content,
          body.parent_id
        );
        storage.createComment(comment);

        res.status(201).json({ comment });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions/:version/comments
     * List all comments for a version.
     */
    listByVersion: (req: Request<VersionParams>, res: Response, next: NextFunction) => {
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

        const comments = storage.listCommentsByVersion(id, versionNum);
        const unresolvedCount = storage.countUnresolvedComments(id, versionNum);

        res.json({ comments, unresolved_count: unresolvedCount });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions/:version/steps/:stepId/comments
     * List comments for a specific step.
     */
    listByStep: (req: Request<StepParams>, res: Response, next: NextFunction) => {
      try {
        const { id, version: versionStr, stepId } = req.params;
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

        const comments = storage.listCommentsByStep(id, versionNum, stepId);
        const unresolvedCount = storage.countUnresolvedCommentsByStep(id, versionNum, stepId);

        res.json({ comments, unresolved_count: unresolvedCount });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/versions/:version/comments/:commentId
     * Get a specific comment.
     */
    get: (req: Request<CommentParams>, res: Response, next: NextFunction) => {
      try {
        const { commentId } = req.params;

        const comment = storage.getComment(commentId);
        if (!comment) {
          throw notFound('Comment');
        }

        res.json({ comment });
      } catch (err) {
        next(err);
      }
    },

    /**
     * PATCH /plans/:id/versions/:version/comments/:commentId
     * Update a comment's content.
     */
    update: (req: Request<CommentParams>, res: Response, next: NextFunction) => {
      try {
        const { commentId } = req.params;
        const body = UpdateCommentRequestSchema.parse(req.body);

        const existingComment = storage.getComment(commentId);
        if (!existingComment) {
          throw notFound('Comment');
        }

        const comment = storage.updateComment(commentId, body.content);
        if (!comment) {
          throw notFound('Comment');
        }

        res.json({ comment });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions/:version/comments/:commentId/resolve
     * Mark a comment as resolved.
     */
    resolve: (req: Request<CommentParams>, res: Response, next: NextFunction) => {
      try {
        const { commentId } = req.params;
        const body = ResolveCommentRequestSchema.parse(req.body);

        const existingComment = storage.getComment(commentId);
        if (!existingComment) {
          throw notFound('Comment');
        }

        if (existingComment.resolved) {
          throw badRequest('Comment is already resolved');
        }

        const comment = storage.resolveComment(commentId, body.resolved_by);
        if (!comment) {
          throw notFound('Comment');
        }

        res.json({ comment });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/versions/:version/comments/:commentId/unresolve
     * Mark a comment as unresolved.
     */
    unresolve: (req: Request<CommentParams>, res: Response, next: NextFunction) => {
      try {
        const { commentId } = req.params;

        const existingComment = storage.getComment(commentId);
        if (!existingComment) {
          throw notFound('Comment');
        }

        if (!existingComment.resolved) {
          throw badRequest('Comment is not resolved');
        }

        const comment = storage.unresolveComment(commentId);
        if (!comment) {
          throw notFound('Comment');
        }

        res.json({ comment });
      } catch (err) {
        next(err);
      }
    },

    /**
     * DELETE /plans/:id/versions/:version/comments/:commentId
     * Delete a comment.
     */
    delete: (req: Request<CommentParams>, res: Response, next: NextFunction) => {
      try {
        const { commentId } = req.params;

        const existingComment = storage.getComment(commentId);
        if (!existingComment) {
          throw notFound('Comment');
        }

        const deleted = storage.deleteComment(commentId);
        if (!deleted) {
          throw notFound('Comment');
        }

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}
