import { z } from 'zod';
import { StepSchema } from '../domain/step.js';
import { PlanStatusSchema } from '../domain/status.js';
import { PlanSourceSchema, UnderstandingSchema } from '../domain/plan.js';
import { DecompositionConfigSchema } from '../domain/decomposition-config.js';

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
  /** Plan source (manual, ideation, or intake) */
  source: PlanSourceSchema.optional(),
  /** Understanding from ideation session */
  understanding: UnderstandingSchema.optional(),
  /** DOT Framework: Decomposition limits and thresholds */
  decomposition_config: DecompositionConfigSchema.optional(),
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
  /** DOT Framework: Decomposition limits and thresholds */
  decomposition_config: DecompositionConfigSchema.optional(),
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
  /** DOT Framework: Decomposition limits and thresholds */
  decomposition_config: DecompositionConfigSchema.optional(),
});

export type CreateVersionRequest = z.infer<typeof CreateVersionRequestSchema>;
