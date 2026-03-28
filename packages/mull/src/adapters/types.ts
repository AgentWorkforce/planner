import { z } from 'zod';

// --- Zod Schemas ---

export const MessageSchema = z.object({
  role: z.enum(['user', 'agent', 'system']),
  agentName: z.string().optional(),
  content: z.string(),
  timestamp: z.string().datetime(),
});

export const SessionEventSchema = z.object({
  type: z.enum([
    'tool_call',
    'file_modified',
    'error',
    'status_transition',
    'decision',
    'message_sent',
    'agent_spawned',
    'chapter_start',
  ]),
  description: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const DecisionSchema = z.object({
  title: z.string(),
  chosen: z.string(),
  rejected: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.string().datetime(),
  /** 'trail' marks pre-structured decisions that bypass LLM inference */
  source: z.string().optional(),
});

export const RetrospectiveDecisionSchema = z.object({
  question: z.string(),
  chosen: z.string(),
  reasoning: z.string(),
  /** Links to forge trajectory event IDs for causal chain tracking */
  linkedEventIds: z.array(z.string()).optional(),
});

export const RetrospectiveSchema = z.object({
  summary: z.string(),
  approach: z.string().optional(),
  decisions: z.array(RetrospectiveDecisionSchema).optional(),
  challenges: z.string().optional(),
  lessonsLearned: z.string().optional(),
  suggestions: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const ArtifactSchema = z.object({
  type: z.enum(['commit', 'file', 'pr', 'external']),
  path: z.string().optional(),
  reference: z.string().optional(),
});

export const SessionDataSchema = z.object({
  sessionId: z.string(),
  source: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  messages: z.array(MessageSchema),
  events: z.array(SessionEventSchema),
  decisions: z.array(DecisionSchema).optional(),
  retrospective: RetrospectiveSchema.optional(),
  artifacts: z.array(ArtifactSchema).optional(),
});

/** Lightweight session info for listing (no full messages/events) */
export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  source: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});

export const CursorDataSchema = z.object({
  sessionId: z.string(),
  lastMulledAt: z.string().datetime(),
});

// --- Inferred Types ---

export type Message = z.infer<typeof MessageSchema>;
export type SessionEvent = z.infer<typeof SessionEventSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type RetrospectiveDecision = z.infer<typeof RetrospectiveDecisionSchema>;
export type Retrospective = z.infer<typeof RetrospectiveSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type CursorData = z.infer<typeof CursorDataSchema>;

// --- SessionAdapter Interface ---

/** Contract for loading session data from any source (trajectory, relay, transcript, etc.) */
export interface SessionAdapter {
  /** Load full session data by ID, validated via SessionDataSchema */
  loadSession(sessionId: string): Promise<SessionData>;

  /** List available sessions, optionally filtered by time range */
  listSessions(opts?: { after?: string; before?: string }): Promise<SessionInfo[]>;

  /** Get the cursor (last processed timestamp) for incremental processing */
  getCursor(sessionId: string): Promise<CursorData | null>;

  /** Set the cursor after successful processing */
  setCursor(sessionId: string, timestamp: string): Promise<void>;
}
