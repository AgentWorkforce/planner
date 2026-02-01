/**
 * Ideation API - Request/Response Schemas
 *
 * Zod schemas for API validation and type inference.
 */

import { z } from 'zod';
import {
  SessionStatusSchema,
  UnderstandingSchema,
  TranscriptRoleSchema,
} from '../domain/index.js';

// =============================================================================
// Session Request Schemas
// =============================================================================

/**
 * Request to create a new ideation session.
 */
export const CreateSessionRequestSchema = z.object({
  /** The initial idea/intent to explore */
  initial_intent: z.string().min(1, 'Initial intent is required'),
  /** Optional initiative to associate with */
  initiative_id: z.string().optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

/**
 * Query params for listing sessions.
 */
export const ListSessionsQuerySchema = z.object({
  /** Filter by status */
  status: SessionStatusSchema.optional(),
  /** Filter by initiative */
  initiative_id: z.string().optional(),
});
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;

// =============================================================================
// Message Request Schemas
// =============================================================================

/**
 * Request to add a message to transcript.
 */
export const AddMessageRequestSchema = z.object({
  /** Message role: 'user' or 'assistant' */
  role: TranscriptRoleSchema,
  /** Message content */
  content: z.string().min(1, 'Content is required'),
});
export type AddMessageRequest = z.infer<typeof AddMessageRequestSchema>;

// =============================================================================
// Understanding Request Schemas
// =============================================================================

/**
 * Request to update specialist observations.
 * Note: specialist name comes from URL param, not body.
 */
export const UpdateUnderstandingRequestSchema = z.object({
  /** Freeform observations object */
  observations: z.record(z.string(), z.unknown()),
});
export type UpdateUnderstandingRequest = z.infer<typeof UpdateUnderstandingRequestSchema>;

// =============================================================================
// Send to Planner Request Schemas
// =============================================================================

/**
 * Request to send current understanding to planner.
 */
export const SendToPlannerRequestSchema = z.object({
  /** Optional goal override (defaults to initial_intent) */
  goal: z.string().optional(),
  /** Optional context to include */
  context: z.string().optional(),
  /** Optional initiative to associate the plan with */
  initiative_id: z.string().optional(),
});
export type SendToPlannerRequest = z.infer<typeof SendToPlannerRequestSchema>;

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Confidence response.
 */
export const ConfidenceResponseSchema = z.object({
  /** Aggregate score 0-100 */
  score: z.number().min(0).max(100),
  /** Level for display: low/medium/high */
  level: z.enum(['low', 'medium', 'high']),
  /** Per-specialist breakdown */
  breakdown: z.record(z.string(), z.string().optional()),
});
export type ConfidenceResponse = z.infer<typeof ConfidenceResponseSchema>;

/**
 * Send to planner response.
 */
export const SendToPlannerResponseSchema = z.object({
  /** The created/updated plan ID */
  plan_id: z.string(),
  /** The plan version */
  plan_version: z.number(),
  /** When sent */
  sent_at: z.string(),
});
export type SendToPlannerResponse = z.infer<typeof SendToPlannerResponseSchema>;

// =============================================================================
// Error Response
// =============================================================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
