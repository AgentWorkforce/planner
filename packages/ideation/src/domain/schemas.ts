/**
 * Ideation Domain Schemas
 *
 * Core entities for the Ideation package:
 * - Session: A brainstorming conversation
 * - Nugget: Crystallized output with understanding
 * - Understanding: Agent observations aggregated by role
 * - AgentObservations: Individual agent's insights
 */

import { z } from 'zod';

// =============================================================================
// Agent Observations
// =============================================================================

/**
 * Confidence level indicates how sure an agent is about their observations.
 * - exploring: Still gathering information, observations are tentative
 * - forming: Patterns emerging, gaining confidence
 * - confident: Clear understanding, ready for specification
 */
export const ConfidenceLevelSchema = z.enum(['exploring', 'forming', 'confident']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Observations from a single specialist agent (architect, designer, tester, security).
 * These are free-form, exploratory notes captured during brainstorming.
 */
export const AgentObservationsSchema = z.object({
  /** What the agent noticed from the conversation */
  observations: z.array(z.string()).optional(),
  /** Domain-relevant terms and concepts */
  keywords: z.array(z.string()).optional(),
  /** Open questions that need resolution */
  questions: z.array(z.string()).optional(),
  /** Potential issues or risks flagged */
  concerns: z.array(z.string()).optional(),
  /** Links to relevant docs, code, or external resources */
  references: z.array(z.string()).optional(),
  /** How confident the agent is in their understanding */
  confidence: ConfidenceLevelSchema.optional(),
  /** When these observations were last updated */
  updated_at: z.string().optional(),
});
export type AgentObservations = z.infer<typeof AgentObservationsSchema>;

/**
 * Understanding is a map of role → AgentObservations.
 * Roles are typically: architect, designer, tester, security.
 * Can be extended with custom roles.
 */
export const UnderstandingSchema = z.record(z.string(), AgentObservationsSchema);
export type Understanding = z.infer<typeof UnderstandingSchema>;

// =============================================================================
// Transcript
// =============================================================================

/**
 * A single message in the brainstorming conversation.
 */
export const TranscriptMessageSchema = z.object({
  /** Who sent this message */
  role: z.enum(['user', 'assistant', 'system', 'specialist']),
  /** The message content */
  content: z.string(),
  /** When this message was sent */
  timestamp: z.string(),
  /** If role is 'specialist', which agent (e.g., 'architect', 'security') */
  agent_id: z.string().optional(),
});
export type TranscriptMessage = z.infer<typeof TranscriptMessageSchema>;

// =============================================================================
// Session
// =============================================================================

/**
 * Session status lifecycle:
 * - active: Brainstorming in progress
 * - crystallized: Nugget has been extracted, session complete
 * - promoted: Nugget has been sent to Planner
 * - abandoned: Session was abandoned without crystallization
 */
export const SessionStatusSchema = z.enum(['active', 'crystallized', 'promoted', 'abandoned']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Where the session originated from.
 */
export const SessionSourceSchema = z.object({
  /** How this session was initiated */
  type: z.enum(['human_initiated', 'intake_signal', 'import']),
  /** For intake_signal: the channel that triggered this */
  channel: z.string().optional(),
  /** For import: the document URL that was imported */
  document_url: z.string().optional(),
  /** Who initiated this session */
  initiated_by: z.string().optional(),
});
export type SessionSource = z.infer<typeof SessionSourceSchema>;

/**
 * An ideation session - a brainstorming conversation.
 */
export const SessionSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** Current status in the lifecycle */
  status: SessionStatusSchema,
  /** Where this session originated */
  source: SessionSourceSchema,
  /** The initial intent or idea that started this session */
  initial_intent: z.string(),
  /** Full conversation transcript */
  transcript: z.array(TranscriptMessageSchema),
  /** Agent observations accumulated during brainstorming */
  understanding: UnderstandingSchema,
  /** ID of the nugget if crystallized */
  nugget_id: z.string().nullable(),
  /** When this session was created */
  created_at: z.string(),
  /** When this session was last updated */
  updated_at: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

// =============================================================================
// Nugget
// =============================================================================

/**
 * Optional initial specification hints captured during ideation.
 * These are rough outlines, not full specifications.
 */
export const InitialSpecificationSchema = z.object({
  /** Architectural hints (boundaries, patterns, tech choices) */
  architecture: z.record(z.string(), z.unknown()).optional(),
  /** Design hints (UI/UX patterns, user flows) */
  design: z.record(z.string(), z.unknown()).optional(),
  /** Testing hints (edge cases, coverage needs) */
  testing: z.record(z.string(), z.unknown()).optional(),
  /** Security hints (auth, data sensitivity, compliance) */
  security: z.record(z.string(), z.unknown()).optional(),
});
export type InitialSpecification = z.infer<typeof InitialSpecificationSchema>;

/**
 * A nugget is the crystallized output of an ideation session.
 * It contains everything needed to create a Plan in the Planner.
 */
export const NuggetSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  /** The session this nugget was crystallized from */
  session_id: z.string(),
  /** Clear, actionable goal statement */
  goal: z.string(),
  /** Background context and motivation */
  context: z.string().optional(),
  /** Explicit constraints or non-goals */
  constraints: z.array(z.string()).optional(),
  /** Agent observations from ideation */
  understanding: UnderstandingSchema,
  /** Optional initial specification hints */
  initial_specification: InitialSpecificationSchema.optional(),
  /** ID of the plan created from this nugget (if promoted) */
  plan_id: z.string().nullable(),
  /** When this nugget was crystallized */
  created_at: z.string(),
  /** When this nugget was last updated */
  updated_at: z.string(),
});
export type Nugget = z.infer<typeof NuggetSchema>;

// =============================================================================
// API Request/Response Schemas
// =============================================================================

export const CreateSessionRequestSchema = z.object({
  initial_intent: z.string().min(1, 'Initial intent is required'),
  source: SessionSourceSchema.optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const AddMessageRequestSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'specialist']),
  content: z.string().min(1, 'Content is required'),
  agent_id: z.string().optional(),
});
export type AddMessageRequest = z.infer<typeof AddMessageRequestSchema>;

export const UpdateObservationsRequestSchema = AgentObservationsSchema;
export type UpdateObservationsRequest = z.infer<typeof UpdateObservationsRequestSchema>;

export const CrystallizeRequestSchema = z.object({
  goal: z.string().min(1, 'Goal is required'),
  context: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  initial_specification: InitialSpecificationSchema.optional(),
});
export type CrystallizeRequest = z.infer<typeof CrystallizeRequestSchema>;

export const ListSessionsQuerySchema = z.object({
  status: SessionStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
