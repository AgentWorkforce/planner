/**
 * Request/response Zod schemas for the forge-next API.
 *
 * Zod is the source of truth. TypeScript types are inferred from schemas.
 */

import { z } from 'zod';
import { RunStatusSchema, StepOverrideSchema, ExecutionPolicySchema } from '../types.js';

// ---------------------------------------------------------------------------
// Run creation
// ---------------------------------------------------------------------------

export const CreateRunRequestSchema = z.object({
  plan_id: z.string().min(1, 'plan_id is required'),
  plan_version: z.number().int().positive().optional(),
  workspace_path: z.string().optional(),
  execution_policy: ExecutionPolicySchema.optional(),
  step_overrides: z.array(StepOverrideSchema).default([]),
});

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;

// ---------------------------------------------------------------------------
// Run responses
// ---------------------------------------------------------------------------

export const CreateRunResponseSchema = z.object({
  run_id: z.string(),
  status: RunStatusSchema,
});

export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;

// ---------------------------------------------------------------------------
// Gate decision
// ---------------------------------------------------------------------------

export const GateDecisionRequestSchema = z.object({
  approver: z.string().optional(),
  note: z.string().optional(),
});

export type GateDecisionRequest = z.infer<typeof GateDecisionRequestSchema>;

// ---------------------------------------------------------------------------
// Question answer
// ---------------------------------------------------------------------------

export const AnswerQuestionRequestSchema = z.object({
  answer: z.string().min(1, 'answer is required'),
});

export type AnswerQuestionRequest = z.infer<typeof AnswerQuestionRequestSchema>;

// ---------------------------------------------------------------------------
// List runs query
// ---------------------------------------------------------------------------

export const ListRunsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(v => (v !== undefined ? parseInt(v, 10) : 50))
    .pipe(z.number().int().positive().max(200)),
});

export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;

// ---------------------------------------------------------------------------
// List questions query
// ---------------------------------------------------------------------------

export const ListQuestionsQuerySchema = z.object({
  status: z.enum(['pending', 'answered', 'dismissed']).optional(),
});

export type ListQuestionsQuery = z.infer<typeof ListQuestionsQuerySchema>;
