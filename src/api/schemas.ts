import { z } from 'zod';
import { StepSchema } from '../domain/step.js';
import { PlanStatusSchema } from '../domain/status.js';

/**
 * Request schema for creating a new plan.
 */
export const CreatePlanRequestSchema = z.object({
  goal: z.string().min(1, 'Goal is required'),
  context: z.string().optional(),
  /** Request AI assistance for plan creation */
  ai_assist: z.boolean().optional().default(false),
  /** Associate plan with an initiative */
  initiative_id: z.string().uuid().optional(),
});

export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;

/**
 * Request schema for creating a new comment.
 */
export const CreateCommentRequestSchema = z.object({
  step_id: z.string().uuid(),
  author: z.string().min(1),
  content: z.string().min(1),
  parent_id: z.string().uuid().optional(),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

/**
 * Request schema for updating a comment.
 */
export const UpdateCommentRequestSchema = z.object({
  content: z.string().min(1),
});

export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequestSchema>;

/**
 * Request schema for resolving a comment.
 */
export const ResolveCommentRequestSchema = z.object({
  resolved_by: z.string().min(1),
});

export type ResolveCommentRequest = z.infer<typeof ResolveCommentRequestSchema>;

/**
 * Request schema for updating a plan's draft version.
 */
export const UpdatePlanRequestSchema = z.object({
  goal: z.string().min(1).optional(),
  context: z.string().optional(),
  steps: z.array(StepSchema).optional(),
  /** Update the initiative association */
  initiative_id: z.string().uuid().optional().nullable(),
});

export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequestSchema>;

/**
 * Query schema for listing plans.
 */
export const ListPlansQuerySchema = z.object({
  status: PlanStatusSchema.optional(),
  /** When true, includes attention_types for each plan */
  include_attention: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  /** Filter plans by initiative */
  initiative_id: z.string().uuid().optional(),
});

export type ListPlansQuery = z.infer<typeof ListPlansQuerySchema>;

/**
 * Request schema for creating a new version.
 */
export const CreateVersionRequestSchema = z.object({
  goal: z.string().min(1).optional(),
  context: z.string().optional(),
  steps: z.array(StepSchema).optional(),
});

export type CreateVersionRequest = z.infer<typeof CreateVersionRequestSchema>;

/**
 * Project config schema for scopes and execution policies.
 */
export const ProjectConfigSchema = z.object({
  scopes: z.object({
    workspace_path: z.string().optional(),
    remote_url: z.string().optional(),
    default_branch: z.string().optional(),
  }).optional(),
  execution_policy: z.object({
    max_concurrent: z.number().int().positive().optional(),
    timeout: z.number().positive().optional(),
    retries: z.number().int().min(0).optional(),
    budget: z.number().positive().optional(),
  }).optional(),
}).optional();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Request schema for creating a new project.
 */
export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(200),
  owner_id: z.string().optional(),
  initiative_id: z.string().optional(),
  config: ProjectConfigSchema,
});

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

/**
 * Request schema for updating a project.
 */
export const UpdateProjectRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  owner_id: z.string().nullable().optional(),
  initiative_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  plan_id: z.string().nullable().optional(),
  run_id: z.string().nullable().optional(),
  config: ProjectConfigSchema,
});

export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

/**
 * Request schema for updating project focus.
 */
export const UpdateProjectFocusSchema = z.object({
  current_focus: z.any(),
});

export type UpdateProjectFocus = z.infer<typeof UpdateProjectFocusSchema>;

/**
 * Query schema for listing projects.
 */
export const ListProjectsQuerySchema = z.object({
  owner_id: z.string().optional(),
  initiative_id: z.string().optional(),
});

export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
