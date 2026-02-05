/**
 * Ideation Domain - TranscriptMessage Schema
 *
 * Transcript captures user + assistant messages only.
 * Specialists never appear in the transcript - Interviewer weaves their insights naturally.
 */

import { z } from 'zod';
import { TranscriptRoleSchema } from './types.js';

// =============================================================================
// TranscriptMessage Schema
// =============================================================================

/**
 * A single message in the ideation conversation.
 *
 * Only user and assistant roles - specialists are invisible to the user.
 * The Interviewer presents specialist insights as its own questions.
 */
export const TranscriptMessageSchema = z.object({
  /** Unique message identifier */
  id: z.string(),
  /** Who sent this message: 'user' or 'assistant' */
  role: TranscriptRoleSchema,
  /** The message content */
  content: z.string(),
  /** When this message was sent (ISO 8601) */
  timestamp: z.string(),
});

export type TranscriptMessage = z.infer<typeof TranscriptMessageSchema>;

/**
 * Creates a new transcript message with generated ID and timestamp.
 */
export function createTranscriptMessage(
  role: 'user' | 'assistant',
  content: string
): TranscriptMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}
