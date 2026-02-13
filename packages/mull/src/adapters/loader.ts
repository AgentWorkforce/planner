/**
 * Session loading orchestrator.
 *
 * loadSessionFromAdapters routes a SessionRef to the correct adapters,
 * reads data with cursor-based incremental filtering, converts raw
 * SessionEntry[] into SessionData, and merges results from all adapters.
 */

import type {
  SessionAdapter,
  SessionEntry,
  SessionData,
  SessionMessage,
  SessionEvent,
  SessionDecision,
  SessionArtifact,
} from './core-types.js';
import { getCursor } from './cursor.js';
import { mergeSessionData } from './merge.js';

// ---------------------------------------------------------------------------
// SessionRef — discriminated union for routing
// ---------------------------------------------------------------------------

export type SessionRef =
  | { type: 'plan'; plan_id: string }
  | { type: 'run'; run_id: string }
  | { type: 'channel'; channel: string };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LoadSessionOptions {
  /** When true, ignore cursors and load full session data. */
  force?: boolean;
  /** Path to .mull directory for cursor storage. Defaults to '.mull'. */
  mullDir?: string;
}

// ---------------------------------------------------------------------------
// Routing table
// ---------------------------------------------------------------------------

/** Maps SessionRef discriminant to the adapter types that should be queried. */
const ADAPTER_ROUTING: Record<SessionRef['type'], ReadonlySet<string>> = {
  plan: new Set(['trail']),
  run: new Set(['relay', 'relay-daemon', 'transcript', 'forge']),
  channel: new Set(['relay', 'relay-daemon']),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a cursor-safe session ID from a SessionRef.
 * Channel names like "#plan-abc" are sanitized for filesystem paths.
 */
export function sessionIdFromRef(ref: SessionRef): string {
  switch (ref.type) {
    case 'plan':
      return ref.plan_id;
    case 'run':
      return ref.run_id;
    case 'channel':
      return ref.channel.replace(/^#/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

/**
 * Convert raw SessionEntry[] from an adapter into structured SessionData.
 *
 * Classification by entry.type:
 *  - 'message'       → SessionMessage
 *  - 'decision'      → SessionDecision
 *  - 'retrospective' → retrospective string (first non-null wins)
 *  - 'artifact'      → SessionArtifact
 *  - anything else   → SessionEvent
 */
export function entriesToSessionData(
  entries: SessionEntry[],
  sessionId: string,
): SessionData {
  const messages: SessionMessage[] = [];
  const events: SessionEvent[] = [];
  const decisions: SessionDecision[] = [];
  const artifacts: SessionArtifact[] = [];
  let retrospective: string | null = null;

  for (const entry of entries) {
    switch (entry.type) {
      case 'message': {
        const c = entry.content as Record<string, unknown>;
        messages.push({
          timestamp: entry.timestamp,
          source: entry.source,
          role: String(c.role ?? 'unknown'),
          content: String(c.content ?? ''),
        });
        break;
      }
      case 'decision': {
        const c = entry.content as Record<string, unknown>;
        decisions.push({
          id: String(c.id ?? `${entry.source}-${entry.timestamp}`),
          timestamp: entry.timestamp,
          source: entry.source,
          description: String(c.description ?? ''),
          rationale: c.rationale ? String(c.rationale) : undefined,
        });
        break;
      }
      case 'retrospective': {
        if (retrospective === null) {
          // Content can be a structured object or a string
          // If it's an object, serialize it; otherwise use as-is
          retrospective = typeof entry.content === 'string'
            ? entry.content
            : JSON.stringify(entry.content);
        }
        break;
      }
      case 'artifact': {
        const c = entry.content as Record<string, unknown>;
        artifacts.push({
          id: String(c.id ?? `${entry.source}-${entry.timestamp}`),
          source: entry.source,
          type: String(c.type ?? 'unknown'),
          path: c.path ? String(c.path) : undefined,
          content: c.content ? String(c.content) : undefined,
        });
        break;
      }
      default: {
        events.push({
          timestamp: entry.timestamp,
          source: entry.source,
          type: entry.type,
          payload: entry.content,
        });
        break;
      }
    }
  }

  return {
    messages,
    events,
    decisions,
    retrospective,
    artifacts,
    metadata: { session_id: sessionId },
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Load session data from all applicable adapters and merge results.
 *
 * Routing:
 *  - plan_id  → trail adapter
 *  - run_id   → relay + transcript adapters
 *  - channel  → relay adapter
 *
 * For each applicable adapter:
 *  1. Check cursor (skipped when force=true)
 *  2. Call adapter.read() with cursor for incremental filtering
 *  3. Convert entries to SessionData
 *
 * Empty adapter results (no entries) are filtered out before merge.
 *
 * @returns Merged SessionData from all adapters, or empty SessionData if
 *          no adapter returned data.
 */
export async function loadSessionFromAdapters(
  sessionRef: SessionRef,
  adapters: SessionAdapter[],
  opts: LoadSessionOptions = {},
): Promise<SessionData> {
  const { force = false, mullDir } = opts;
  const sessionId = sessionIdFromRef(sessionRef);
  const allowedTypes = ADAPTER_ROUTING[sessionRef.type];

  // Filter adapters to those applicable for this SessionRef type
  const applicableAdapters = adapters.filter(a => allowedTypes.has(a.type));

  if (applicableAdapters.length === 0) {
    throw new Error(
      `No applicable adapters for session ref type '${sessionRef.type}'. ` +
      `Expected adapter types: ${[...allowedTypes].join(', ')}; ` +
      `got: ${adapters.map(a => a.type).join(', ') || 'none'}`,
    );
  }

  const results: SessionData[] = [];

  for (const adapter of applicableAdapters) {
    // Check cursor unless force=true
    const cursor = force ? null : await getCursor(adapter.type, sessionId, mullDir);

    // Load entries from adapter (cursor enables incremental filtering)
    const entries = await adapter.read(sessionId, cursor ?? undefined);

    // Empty adapter results filtered out before merge
    if (entries.length === 0) continue;

    // Convert entries to structured SessionData
    const sessionData = entriesToSessionData(entries, sessionId);
    results.push(sessionData);
  }

  // No adapters returned data → return empty SessionData
  if (results.length === 0) {
    return {
      messages: [],
      events: [],
      decisions: [],
      retrospective: null,
      artifacts: [],
      metadata: { session_id: sessionId },
    };
  }

  return mergeSessionData(results);
}
