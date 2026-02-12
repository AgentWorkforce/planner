/**
 * Core types for mull session adapters.
 *
 * SessionAdapter is the interface all adapters must implement.
 * Each adapter reads session data from a different source
 * (trajectory events, relay messages, transcript files).
 */

/** A single entry from any session data source. */
export interface SessionEntry {
  timestamp: string; // ISO 8601
  source: string;    // adapter type that produced this entry
  type: string;      // entry-specific type (e.g. 'decision', 'message', 'utterance')
  content: unknown;  // source-specific payload
}

/** Cursor position for incremental reads. */
export interface Cursor {
  last_mulled_at: string; // ISO 8601 timestamp of last processed entry
}

/** Time range filter for session listing. */
export interface TimeRange {
  after?: string;  // ISO 8601 — include sessions overlapping after this time
  before?: string; // ISO 8601 — include sessions overlapping before this time
}

/** Session info returned by a single adapter's listSessions. */
export interface AdapterSessionInfo {
  sessionId: string;
  startedAt?: string; // ISO 8601
  endedAt?: string;   // ISO 8601
}

/** Aggregated session info across multiple adapters. */
export interface SessionInfo {
  sessionId: string;
  adapters: string[];   // adapter types that can provide data for this session
  startedAt?: string;   // earliest start across adapters
  endedAt?: string;     // latest end across adapters
}

/** Common interface all session adapters implement. */
export interface SessionAdapter {
  /** Adapter type identifier (e.g. 'trajectory', 'relay', 'transcript'). */
  readonly type: string;

  /**
   * Read session entries, optionally from a cursor position.
   * Returns entries sorted by timestamp ascending.
   */
  read(sessionId: string, since?: Cursor): Promise<SessionEntry[]>;

  /**
   * List available sessions, optionally filtered by time range.
   * Not all adapters support this — adapters that don't implement it
   * are skipped during cross-adapter session listing.
   */
  listSessions?(timeRange?: TimeRange): Promise<AdapterSessionInfo[]>;
}

/** A timestamped message from any session source. */
export interface SessionMessage {
  timestamp: string; // ISO 8601
  source: string;    // adapter type that produced this message
  role: string;      // e.g. 'user', 'assistant', 'agent', 'system'
  content: string;
}

/** A timestamped event from any session source. */
export interface SessionEvent {
  timestamp: string; // ISO 8601
  source: string;    // adapter type that produced this event
  type: string;      // e.g. 'tool_call', 'status_change', 'error'
  payload: unknown;
}

/** A decision captured during a session. */
export interface SessionDecision {
  id: string;
  timestamp: string; // ISO 8601
  source: string;    // adapter type
  description: string;
  rationale?: string;
}

/** An artifact produced during a session. */
export interface SessionArtifact {
  id: string;
  source: string;    // adapter type
  type: string;      // e.g. 'file', 'snippet', 'diagram'
  path?: string;
  content?: string;
}

/** Session-level metadata. */
export interface SessionMetadata {
  session_id: string;
  started_at?: string;
  ended_at?: string;
  [key: string]: unknown;
}

/**
 * Structured session data collected from one or more adapters.
 * Each adapter populates the fields it has data for;
 * mergeSessionData combines multiple SessionData results.
 */
export interface SessionData {
  messages: SessionMessage[];
  events: SessionEvent[];
  decisions: SessionDecision[];
  retrospective: string | null;
  artifacts: SessionArtifact[];
  metadata: SessionMetadata;
}

/** Known adapter type strings. */
export type AdapterType = 'trajectory' | 'relay' | 'relay-daemon' | 'transcript';
