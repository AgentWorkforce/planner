/**
 * Adapter bridge: wraps SessionAdapter instances into MullAdapter-compatible objects.
 *
 * All adapter implementations (ForgeDbAdapter, TrajectoryAdapter, RelayDaemonAdapter, etc.)
 * implement SessionAdapter (core-types.ts). The mull pipeline (mull.ts, mullAll.ts) expects
 * MullAdapter (domain/types.ts). This bridge connects the two.
 *
 * Key transformations:
 * - Maps core-types SessionAdapter → domain MullAdapter interface
 * - Converts core-types SessionData (with messages/events/decisions arrays)
 *   → domain SessionData (with flattened messages array + ref)
 * - Routes SessionRef types (plan_id/run_id/channel) to appropriate adapters
 * - Manages cursor persistence via filesystem
 */

import type { SessionAdapter, SessionEntry, Cursor } from './core-types.js';
import type {
  MullAdapter,
  SessionRef,
  SessionData,
  SessionMessage,
  SessionDecision as DomainDecision,
  SessionEvent as DomainEvent,
  SessionRetrospective,
} from '../domain/types.js';
import { entriesToSessionData } from './loader.js';
import { getCursor, setCursor } from './cursor.js';

// ---------------------------------------------------------------------------
// Routing tables
// ---------------------------------------------------------------------------

/**
 * Routing: which domain SessionRef types does each adapter type support?
 * Mirrors ADAPTER_ROUTING in loader.ts but maps domain SessionRef.type → adapter types.
 *
 * Example: plan_id refs route to 'trail' adapter
 */
export const ADAPTER_REF_ROUTING: Record<string, ReadonlySet<string>> = {
  plan_id: new Set(['trail']),
  run_id: new Set(['relay', 'relay-daemon', 'transcript', 'forge', 'baton']),
  channel: new Set(['relay', 'relay-daemon']),
};

/**
 * Inverse mapping: what SessionRef type should each adapter's sessions be listed as?
 *
 * Example: 'trail' adapter produces plan_id session refs
 */
export const ADAPTER_SESSION_TYPE: Record<string, string> = {
  trail: 'plan_id',
  forge: 'run_id',
  relay: 'channel',
  'relay-daemon': 'channel',
  transcript: 'run_id',
  baton: 'run_id',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a session ID for filesystem safety.
 * Replaces non-alphanumeric characters with underscores to satisfy
 * cursor.ts SAFE_SEGMENT validation.
 */
function sanitizeSessionId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Parse retrospective string (JSON or plain text) into structured SessionRetrospective.
 */
function parseRetrospective(raw: string): SessionRetrospective {
  try {
    const parsed = JSON.parse(raw);

    // Check if it's a valid retrospective object with a summary field
    if (typeof parsed === 'object' && parsed !== null && 'summary' in parsed) {
      // Normalize challenges/lessonsLearned/suggestions to arrays
      const normalizeToArray = (value: unknown): string[] | undefined => {
        if (!value) return undefined;
        if (Array.isArray(value)) return value.map(String);
        if (typeof value === 'string') return [value];
        return undefined;
      };

      return {
        summary: String(parsed.summary),
        approach: parsed.approach ? String(parsed.approach) : undefined,
        decisions: parsed.decisions && Array.isArray(parsed.decisions)
          ? parsed.decisions.map((d: any) => ({
              question: String(d.question || ''),
              chosen: String(d.chosen || ''),
              reasoning: d.reasoning ? String(d.reasoning) : undefined,
              linkedEventIds: d.linkedEventIds && Array.isArray(d.linkedEventIds)
                ? d.linkedEventIds.map(String)
                : undefined,
            }))
          : undefined,
        challenges: normalizeToArray(parsed.challenges),
        lessonsLearned: normalizeToArray(parsed.lessonsLearned),
        suggestions: normalizeToArray(parsed.suggestions),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      };
    }
  } catch {
    // JSON parse failed or not an object with summary - treat as plain text
  }

  // Fallback: wrap raw string as summary
  return { summary: raw };
}

/**
 * Format a forge/trajectory event payload into a human-readable description.
 * Extracts the most relevant fields instead of dumping raw JSON.
 */
function formatEventDescription(type: string, payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return type;

  const p = payload as Record<string, unknown>;

  switch (type) {
    case 'task_completed': {
      const title = p.step_title ?? p.task_id ?? 'unknown';
      const notes = p.notes ? ` — ${p.notes}` : '';
      const attempt = p.attempt_number && Number(p.attempt_number) > 1
        ? ` (attempt ${p.attempt_number})`
        : '';
      return `Task completed: ${title}${attempt}${notes}`;
    }
    case 'task_failed': {
      const title = p.step_title ?? p.task_id ?? 'unknown';
      const error = p.error_message ?? p.error ?? 'unknown error';
      return `Task failed: ${title} — ${error}`;
    }
    case 'recovery_strategy_selected': {
      const strategy = p.strategy ?? 'unknown';
      const error = p.error_message ?? '';
      const attempt = p.attempt_number ? ` (attempt ${p.attempt_number})` : '';
      return `Recovery: ${strategy}${attempt}${error ? ` — ${error}` : ''}`;
    }
    case 'decision_recorded': {
      const desc = p.description ?? p.question_text ?? 'unknown';
      const chosen = p.selected_option ?? p.chosen ?? '';
      return chosen ? `Decision: ${desc} → ${chosen}` : `Decision: ${desc}`;
    }
    case 'retrospective_recorded': {
      const summary = p.summary ?? 'Retrospective recorded';
      return `Retrospective: ${String(summary).slice(0, 150)}`;
    }
    case 'agent_spawned': {
      const name = p.agent_name ?? p.name ?? 'unknown';
      const role = p.role ?? '';
      return role ? `Agent spawned: ${name} (${role})` : `Agent spawned: ${name}`;
    }
    case 'gate_reached':
    case 'gate_approved':
    case 'gate_rejected': {
      const step = p.step_title ?? p.step_id ?? 'unknown';
      const action = type.replace('gate_', '');
      return `Gate ${action}: ${step}`;
    }
    case 'checkpoint_created': {
      const desc = p.description ?? p.checkpoint_id ?? 'checkpoint';
      return `Checkpoint: ${desc}`;
    }
    case 'budget_warning': {
      const msg = p.message ?? 'budget threshold reached';
      return `Budget warning: ${msg}`;
    }
    default: {
      // Fallback: extract the most informative field
      const desc = p.description ?? p.message ?? p.summary ?? p.step_title ?? null;
      if (desc) return `${type}: ${desc}`;
      return `${type}: ${JSON.stringify(payload).slice(0, 150)}`;
    }
  }
}

/**
 * Convert core-types SessionData to domain SessionData.
 *
 * This function serves two purposes:
 * 1. Preserves structured data (decisions, events, retrospective) in their typed fields
 * 2. Also flattens them into the messages array for NLP entity extraction
 *
 * The messages array is needed for text-based analysis, but the structured fields
 * preserve the original data fidelity for tools and agents that can consume it.
 */
function convertSessionData(
  coreData: import('./core-types.js').SessionData,
  ref: SessionRef,
): SessionData {
  const messages: SessionMessage[] = [];
  let messageIdCounter = 0;

  // Convert core messages
  for (const msg of coreData.messages) {
    messages.push({
      id: `msg-${messageIdCounter++}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      timestamp: msg.timestamp,
    });
  }

  // Convert decisions to messages (for NLP extraction)
  for (const decision of coreData.decisions) {
    let content = `Decision: ${decision.description}`;
    if (decision.rationale) {
      content += `\n\nRationale: ${decision.rationale}`;
    }
    messages.push({
      id: decision.id,
      role: 'assistant',
      content,
      timestamp: decision.timestamp,
    });
  }

  // Convert events to messages (for NLP extraction)
  // Use role 'assistant' so these pass through filterTranscript
  // (role 'system' is skipped by the transcript filter)
  for (const event of coreData.events) {
    messages.push({
      id: `event-${messageIdCounter++}`,
      role: 'assistant',
      content: formatEventDescription(event.type, event.payload),
      timestamp: event.timestamp,
    });
  }

  // Add retrospective as final message if present (for NLP extraction)
  if (coreData.retrospective) {
    // Use latest timestamp from existing messages, or current time
    const lastMsg = messages[messages.length - 1];
    const latestTimestamp = lastMsg ? lastMsg.timestamp : new Date().toISOString();

    messages.push({
      id: 'retrospective',
      role: 'assistant',
      content: coreData.retrospective,
      timestamp: latestTimestamp,
    });
  }

  // Sort all messages by timestamp ascending
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Map structured decisions
  const decisions: DomainDecision[] = coreData.decisions.map(d => ({
    id: d.id,
    description: d.description,
    rationale: d.rationale,
    timestamp: d.timestamp,
    source: d.source,
  }));

  // Map structured events — produce human-readable descriptions from payloads
  const events: DomainEvent[] = coreData.events.map(e => ({
    type: e.type,
    description: formatEventDescription(e.type, e.payload),
    timestamp: e.timestamp,
    metadata: typeof e.payload === 'object' && e.payload !== null
      ? e.payload as Record<string, unknown>
      : undefined,
  }));

  // Parse retrospective
  let retrospective: SessionRetrospective | null = null;
  if (coreData.retrospective) {
    retrospective = parseRetrospective(coreData.retrospective);
  }

  return {
    ref,
    messages,
    decisions: decisions.length > 0 ? decisions : undefined,
    events: events.length > 0 ? events : undefined,
    retrospective,
    metadata: coreData.metadata as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Bridge implementation
// ---------------------------------------------------------------------------

/**
 * Wrap a single SessionAdapter into a MullAdapter.
 *
 * @param adapter - The SessionAdapter implementation to wrap
 * @param mullDir - Optional path to .mull directory for cursor storage
 */
export function toMullAdapter(adapter: SessionAdapter, mullDir?: string): MullAdapter {
  return {
    name: adapter.type,

    supports(ref: SessionRef): boolean {
      const supportedAdapters = ADAPTER_REF_ROUTING[ref.type];
      return supportedAdapters ? supportedAdapters.has(adapter.type) : false;
    },

    async listSessions(): Promise<SessionRef[]> {
      // Not all adapters implement listSessions
      if (!adapter.listSessions) {
        return [];
      }

      const sessions = await adapter.listSessions();
      const refType = ADAPTER_SESSION_TYPE[adapter.type];

      if (!refType) {
        // Unknown adapter type - can't determine SessionRef type
        return [];
      }

      // Convert AdapterSessionInfo to domain SessionRef
      // Use type assertion since Zod validates plan_id|run_id|channel at runtime
      return sessions.map(info => ({
        type: refType as 'plan_id' | 'run_id' | 'channel',
        id: info.sessionId,
      }));
    },

    async loadSession(ref: SessionRef, opts?: { after?: string }): Promise<SessionData> {
      // Extract session ID from domain SessionRef
      const sessionId = ref.id;

      // Build cursor if needed
      const cursor: Cursor | undefined = opts?.after
        ? { last_mulled_at: opts.after }
        : undefined;

      // Read entries from adapter
      const entries: SessionEntry[] = await adapter.read(sessionId, cursor);

      // Convert entries to core SessionData
      const coreData = entriesToSessionData(entries, sessionId);

      // Convert to domain SessionData
      return convertSessionData(coreData, ref);
    },

    async getCursor(ref: SessionRef): Promise<string | null> {
      // Sanitize session ID for filesystem safety
      const sanitizedId = sanitizeSessionId(ref.id);

      // Retrieve cursor from filesystem
      const cursor = await getCursor(adapter.type, sanitizedId, mullDir);

      return cursor?.last_mulled_at ?? null;
    },

    async setCursor(ref: SessionRef, cursor: string): Promise<void> {
      // Sanitize session ID for filesystem safety
      const sanitizedId = sanitizeSessionId(ref.id);

      // Persist cursor to filesystem
      await setCursor(adapter.type, sanitizedId, cursor, mullDir);
    },
  };
}

/**
 * Wrap multiple SessionAdapters into MullAdapters.
 *
 * @param adapters - Array of SessionAdapter implementations to wrap
 * @param mullDir - Optional path to .mull directory for cursor storage
 */
export function toMullAdapters(adapters: SessionAdapter[], mullDir?: string): MullAdapter[] {
  return adapters.map(a => toMullAdapter(a, mullDir));
}
