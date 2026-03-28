import { z } from 'zod';

/**
 * A review comment on a plan step.
 * Comments can be threaded via parent_id and can be resolved.
 */
export const CommentSchema = z.object({
  comment_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  version: z.number().int().positive(),
  step_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  author: z.string().min(1),
  content: z.string().min(1),
  resolved: z.boolean(),
  resolved_by: z.string().nullable(),
  resolved_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Comment = z.infer<typeof CommentSchema>;

/**
 * Creates a new Comment.
 */
export function createComment(
  planId: string,
  version: number,
  stepId: string,
  author: string,
  content: string,
  parentId?: string
): Comment {
  const now = new Date().toISOString();
  const comment: Comment = {
    comment_id: crypto.randomUUID(),
    plan_id: planId,
    version,
    step_id: stepId,
    parent_id: parentId ?? null,
    author,
    content,
    resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
  };
  return CommentSchema.parse(comment);
}

/**
 * Marks a comment as resolved.
 */
export function resolveComment(comment: Comment, resolvedBy: string): Comment {
  const now = new Date().toISOString();
  return CommentSchema.parse({
    ...comment,
    resolved: true,
    resolved_by: resolvedBy,
    resolved_at: now,
    updated_at: now,
  });
}

/**
 * Unresolves a comment.
 */
export function unresolveComment(comment: Comment): Comment {
  const now = new Date().toISOString();
  return CommentSchema.parse({
    ...comment,
    resolved: false,
    resolved_by: null,
    resolved_at: null,
    updated_at: now,
  });
}
