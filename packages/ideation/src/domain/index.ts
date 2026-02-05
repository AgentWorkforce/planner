/**
 * Ideation Domain - Index
 *
 * Exports all schemas and inferred types for the ideation package.
 */

// Types and enums
export {
  SessionStatus,
  SessionStatusSchema,
  TranscriptRole,
  TranscriptRoleSchema,
} from './types.js';

// Understanding (freeform)
export {
  UnderstandingSchema,
  type Understanding,
  createEmptyUnderstanding,
} from './understanding.js';

// Transcript
export {
  TranscriptMessageSchema,
  type TranscriptMessage,
  createTranscriptMessage,
} from './transcript.js';

// PlannerSend
export {
  PlannerSendSourceSchema,
  PlannerSendPayloadSchema,
  PlannerSendResultSchema,
  PlannerSendSchema,
  type PlannerSendSource,
  type PlannerSendPayload,
  type PlannerSendResult,
  type PlannerSend,
  createPlannerSend,
} from './planner-send.js';

// ActiveSpecialist
export {
  ActiveSpecialistSchema,
  type ActiveSpecialist,
  createActiveSpecialist,
} from './active-specialist.js';

// Session
export {
  SessionSourceSchema,
  SessionSchema,
  type SessionSource,
  type Session,
  createSession,
} from './session.js';

// Confidence
export {
  computeAggregateConfidence,
  getConfidenceLevel,
  type ConfidenceBreakdown,
  type AggregateConfidenceResult,
} from './confidence.js';

// Block
export {
  BlockStatus,
  BlockSourceSchema,
  UserEditSchema,
  BlockSchema,
  type BlockSource,
  type UserEdit,
  type Block,
  createBlock,
  createUserEdit,
} from './block.js';
