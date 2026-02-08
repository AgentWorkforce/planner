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
// Block Request Schemas
// =============================================================================

/**
 * Request to create a new block.
 */
export const CreateBlockRequestSchema = z.object({
  /** Block type (feature, entity, flow, constraint, etc.) */
  type: z.string(),
  /** Human-readable title */
  title: z.string(),
  /** Short label for physics block display */
  keyword: z.string(),
  /** Visual identifier on block */
  emoji: z.string(),
  /** Markdown mini-spec content */
  content: z.string().optional().default(''),
  /** Confidence score (0-100) */
  confidence: z.number().min(0).max(100).optional().default(0),
  /** Which specialist created this block (optional, defaults to 'user') */
  specialist: z.string().optional(),
  /** Conversation turn references (optional, defaults to 'user-created') */
  sourceContext: z.string().optional(),
});
export type CreateBlockRequest = z.infer<typeof CreateBlockRequestSchema>;

/**
 * Request to update an existing block.
 * Status can only be set to non-curated values via PATCH.
 * Use the curate endpoint to set status to 'curated'.
 */
export const UpdateBlockRequestSchema = z.object({
  /** Human-readable title */
  title: z.string().optional(),
  /** Short label for physics block display */
  keyword: z.string().optional(),
  /** Visual identifier on block */
  emoji: z.string().optional(),
  /** Markdown mini-spec content */
  content: z.string().optional(),
  /** Confidence score (0-100) */
  confidence: z.number().min(0).max(100).optional(),
  /** Lifecycle status (cannot set to 'curated' via PATCH) */
  status: z.enum(['forming', 'emerging', 'developing', 'ready']).optional(),
  /** True if user has modified this block */
  userEdited: z.boolean().optional(),
  /** Which fields user modified (for highlighting) */
  userEditedFields: z.array(z.string()).optional(),
});
export type UpdateBlockRequest = z.infer<typeof UpdateBlockRequestSchema>;

// =============================================================================
// Session Update Request Schema
// =============================================================================

/**
 * Request to update session fields.
 * Currently supports updating the title (source.initial_intent).
 */
export const UpdateSessionRequestSchema = z.object({
  /** Update the session title (stored as source.initial_intent) */
  title: z.string().min(1, 'Title is required').optional(),
});
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequestSchema>;

// =============================================================================
// Error Response
// =============================================================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
