import { z } from 'zod';

// ============================================
// Retrospective Schema
// ============================================

/**
 * A decision made during task execution, captured in retrospective.
 */
export const RetrospectiveDecisionSchema = z.object({
  question: z.string().min(1),
  chosen: z.string().min(1),
  reasoning: z.string().min(1),
});

export type RetrospectiveDecision = z.infer<typeof RetrospectiveDecisionSchema>;

/**
 * Retrospective data captured from an agent after task completion.
 * This provides structured reflection on the work performed.
 */
export const RetrospectiveSchema = z.object({
  /** Brief summary of what was accomplished */
  summary: z.string().min(1),
  /** Description of the approach taken */
  approach: z.string().min(1),
  /** Key decisions made during execution */
  decisions: z.array(RetrospectiveDecisionSchema),
  /** Challenges encountered during the task */
  challenges: z.array(z.string()),
  /** Learnings from completing the task */
  learnings: z.array(z.string()),
  /** Suggestions for future improvements */
  suggestions: z.array(z.string()),
  /** Confidence level in the work completed (0-1) */
  confidence: z.number().min(0).max(1),
});

export type Retrospective = z.infer<typeof RetrospectiveSchema>;

// ============================================
// Retrospective with Linked Decisions
// ============================================

/**
 * A retrospective decision with linked event IDs from earlier record_decision calls.
 */
export const LinkedRetrospectiveDecisionSchema = RetrospectiveDecisionSchema.extend({
  /** Event IDs of matching decision_recorded trajectory events */
  linked_event_ids: z.array(z.string().uuid()).optional(),
});

export type LinkedRetrospectiveDecision = z.infer<typeof LinkedRetrospectiveDecisionSchema>;

/**
 * Full retrospective with linked decisions.
 */
export const LinkedRetrospectiveSchema = RetrospectiveSchema.extend({
  decisions: z.array(LinkedRetrospectiveDecisionSchema),
});

export type LinkedRetrospective = z.infer<typeof LinkedRetrospectiveSchema>;

// ============================================
// Retrospective Event Payloads
// ============================================

/**
 * Payload for retrospective_recorded trajectory event.
 */
export const RetrospectiveRecordedPayloadSchema = z.object({
  task_id: z.string().uuid(),
  agent_id: z.string().min(1),
  retrospective: LinkedRetrospectiveSchema,
});

export type RetrospectiveRecordedPayload = z.infer<typeof RetrospectiveRecordedPayloadSchema>;

/**
 * Payload for retrospective_timeout trajectory event.
 */
export const RetrospectiveTimeoutPayloadSchema = z.object({
  task_id: z.string().uuid(),
  agent_id: z.string().min(1),
  timeout_duration_ms: z.number().int().positive(),
  agent_last_message: z.string().optional(),
  reason: z.string(),
});

export type RetrospectiveTimeoutPayload = z.infer<typeof RetrospectiveTimeoutPayloadSchema>;

/**
 * Payload for retrospective_parse_error trajectory event.
 */
export const RetrospectiveParseErrorPayloadSchema = z.object({
  task_id: z.string().uuid(),
  agent_id: z.string().min(1),
  raw_response: z.string(),
  parse_error: z.string(),
});

export type RetrospectiveParseErrorPayload = z.infer<typeof RetrospectiveParseErrorPayloadSchema>;

/**
 * Payload for retrospective_validation_error trajectory event.
 */
export const RetrospectiveValidationErrorPayloadSchema = z.object({
  task_id: z.string().uuid(),
  agent_id: z.string().min(1),
  raw_response: z.string(),
  validation_errors: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    })
  ),
});

export type RetrospectiveValidationErrorPayload = z.infer<
  typeof RetrospectiveValidationErrorPayloadSchema
>;

// ============================================
// Retrospective Event Types (to be added to TrajectoryEventType)
// ============================================

/**
 * Event types for retrospective tracking.
 */
export const RetrospectiveEventType = {
  RetrospectiveRecorded: 'retrospective_recorded',
  RetrospectiveTimeout: 'retrospective_timeout',
  RetrospectiveParseError: 'retrospective_parse_error',
  RetrospectiveValidationError: 'retrospective_validation_error',
} as const;

export type RetrospectiveEventType =
  (typeof RetrospectiveEventType)[keyof typeof RetrospectiveEventType];

// ============================================
// Retrospective Result Types
// ============================================

/**
 * Result of a successful retrospective capture.
 */
export interface RetrospectiveSuccess {
  status: 'success';
  retrospective: LinkedRetrospective;
  event_id: string;
}

/**
 * Result when retrospective times out.
 */
export interface RetrospectiveTimeoutResult {
  status: 'timeout';
  timeout_duration_ms: number;
  event_id: string;
}

/**
 * Result when retrospective response cannot be parsed as JSON.
 */
export interface RetrospectiveParseErrorResult {
  status: 'parse_error';
  raw_response: string;
  parse_error: string;
  event_id: string;
}

/**
 * Result when retrospective JSON fails schema validation.
 */
export interface RetrospectiveValidationErrorResult {
  status: 'validation_error';
  raw_response: string;
  validation_errors: Array<{ path: (string | number)[]; message: string }>;
  event_id: string;
}

/**
 * Union of all retrospective result types.
 */
export type RetrospectiveResult =
  | RetrospectiveSuccess
  | RetrospectiveTimeoutResult
  | RetrospectiveParseErrorResult
  | RetrospectiveValidationErrorResult;

// ============================================
// Helper Functions
// ============================================

/**
 * Type guard for successful retrospective result.
 */
export function isRetrospectiveSuccess(result: RetrospectiveResult): result is RetrospectiveSuccess {
  return result.status === 'success';
}

/**
 * Type guard for timeout result.
 */
export function isRetrospectiveTimeout(
  result: RetrospectiveResult
): result is RetrospectiveTimeoutResult {
  return result.status === 'timeout';
}

/**
 * Type guard for parse error result.
 */
export function isRetrospectiveParseError(
  result: RetrospectiveResult
): result is RetrospectiveParseErrorResult {
  return result.status === 'parse_error';
}

/**
 * Type guard for validation error result.
 */
export function isRetrospectiveValidationError(
  result: RetrospectiveResult
): result is RetrospectiveValidationErrorResult {
  return result.status === 'validation_error';
}
