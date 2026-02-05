/**
 * Ideation Domain - Minimal Enums and Primitive Types
 *
 * Intelligence lives in agent prompts, not Zod schemas.
 * These are minimal structural enums only.
 */

import { z } from 'zod';

// =============================================================================
// Session Status
// =============================================================================

/**
 * Session status lifecycle:
 * - active: Brainstorming in progress or paused, can continue ideating
 * - abandoned: Session was abandoned
 *
 * Note: Sessions stay active after sending to planner - user can continue ideating.
 */
export const SessionStatus = {
  Active: 'active',
  Abandoned: 'abandoned',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const SessionStatusSchema = z.enum(['active', 'abandoned']);

// =============================================================================
// Transcript Role
// =============================================================================

/**
 * Transcript message roles.
 * Only user and assistant - specialists never appear in chat.
 * Interviewer weaves specialist insights into its own questions.
 */
export const TranscriptRole = {
  User: 'user',
  Assistant: 'assistant',
} as const;

export type TranscriptRole = (typeof TranscriptRole)[keyof typeof TranscriptRole];

export const TranscriptRoleSchema = z.enum(['user', 'assistant']);

// =============================================================================
// No Fixed Guardian/Specialist Roles
// =============================================================================

/**
 * Specialists are spawned dynamically by the Interviewer based on conversation needs.
 * NOT limited to a predefined set of roles.
 *
 * Example specialist names: 'Architect', 'DataModeller', 'Designer', 'QA', 'Security'
 * But also custom: 'APIDesigner', 'PerformanceExpert', 'AccessibilitySpecialist'
 *
 * These are just strings - no enum constraint.
 */

// =============================================================================
// No Confidence Enum
// =============================================================================

/**
 * Confidence is agent-reported, not schema-enforced.
 * Agents define their own confidence representation in their freeform observations.
 *
 * Convention (for aggregate computation):
 * - 'exploring' -> 25%
 * - 'forming' -> 50%
 * - 'confident' -> 90%
 *
 * But specialists can use any representation they want.
 */
