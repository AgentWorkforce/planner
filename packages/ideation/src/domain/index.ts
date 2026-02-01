/**
 * Ideation Domain Model
 *
 * Exports all domain types and schemas for the Ideation package.
 */

export {
  // Agent Observations
  ConfidenceLevelSchema,
  type ConfidenceLevel,
  AgentObservationsSchema,
  type AgentObservations,
  UnderstandingSchema,
  type Understanding,

  // Transcript
  TranscriptMessageSchema,
  type TranscriptMessage,

  // Session
  SessionStatusSchema,
  type SessionStatus,
  SessionSourceSchema,
  type SessionSource,
  SessionSchema,
  type Session,

  // Nugget
  InitialSpecificationSchema,
  type InitialSpecification,
  NuggetSchema,
  type Nugget,

  // API Request/Response
  CreateSessionRequestSchema,
  type CreateSessionRequest,
  AddMessageRequestSchema,
  type AddMessageRequest,
  UpdateObservationsRequestSchema,
  type UpdateObservationsRequest,
  CrystallizeRequestSchema,
  type CrystallizeRequest,
  ListSessionsQuerySchema,
  type ListSessionsQuery,
} from './schemas.js';
