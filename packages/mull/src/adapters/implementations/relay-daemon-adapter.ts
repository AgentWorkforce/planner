import { createReadStream, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';
import type {
  SessionAdapter,
  SessionEntry,
  Cursor,
  TimeRange,
  AdapterSessionInfo,
} from '../core-types.js';
import type { RelayDaemonAdapterConfig } from '../schemas.js';

// ---------------------------------------------------------------------------
// Envelope types matching agent-relay daemon's storage format
// ---------------------------------------------------------------------------

/** Message shape inside the JSONL Envelope. */
interface RelayMessage {
  id: string;
  ts: number;          // epoch ms
  from: string;        // agent name or '__system__'
  to: string;          // agent name or '#channel'
  kind: string;        // 'message', 'state', 'agent_status', etc.
  body: string;
  data?: Record<string, unknown>;
  status?: string;
  is_urgent?: boolean;
  is_broadcast?: boolean;
}

/** Envelope wrapper in JSONL message files. */
interface MessageEnvelope {
  type: 'message' | 'status';
  message?: RelayMessage;
  // status envelopes have id, status, ts — we skip these
}

/** Session lifecycle events in sessions.jsonl. */
type SessionEvent =
  | {
    type: 'session-start';
    session: {
      id: string;
      agentName: string;
      cli?: string;
      projectId?: string;
      projectRoot?: string;
      startedAt: number;  // epoch ms
      resumeToken?: string;
      messageCount?: number;
    };
  }
  | {
    type: 'session-end';
    id: string;
    endedAt: number;      // epoch ms
    closedBy?: string;
  };

// ---------------------------------------------------------------------------
// Session boundary tracking
// ---------------------------------------------------------------------------

/** Parsed session lifecycle from sessions.jsonl. */
interface AgentSession {
  sessionId: string;
  agentName: string;
  startedAt: number;   // epoch ms
  endedAt?: number;     // epoch ms
}

// ---------------------------------------------------------------------------
// RelayDaemonAdapter
// ---------------------------------------------------------------------------

/**
 * Reads session data from the agent-relay daemon's storage.
 *
 * Unlike RelayJsonlAdapter (which reads plain JSONL files), this adapter
 * understands the daemon's specific storage format:
 *
 * 1. Message JSONL files in <dataDir>/messages/YYYY-MM-DD.jsonl
 *    - Each line is an Envelope<T> with type='message' or type='status'
 *    - Messages have: id, ts (epoch ms), from, to, kind, body, data
 *    - System messages (from='__system__') are filtered out
 *
 * 2. Session lifecycle in <dataDir>/sessions.jsonl
 *    - session-start events define agent lifecycle boundaries
 *    - session-end events mark agent release
 *    - Sessions are reconstructed from these lifecycle events
 *
 * Sessions are identified by the session ID from sessions.jsonl. When
 * querying by agent name, all sessions for that agent are returned.
 */
export class RelayDaemonAdapter implements SessionAdapter {
  readonly type = 'relay-daemon' as const;

  private readonly dataDir: string;
  private readonly sessionsFile: string;

  constructor(config: RelayDaemonAdapterConfig) {
    this.dataDir = config.dataDir;
    this.sessionsFile = config.sessionsFile ?? join(config.dataDir, 'sessions.jsonl');
  }

  /**
   * Read messages for a given session ID.
   *
   * The session ID maps to an agent session from sessions.jsonl. Messages
   * are filtered by time window (startedAt..endedAt) and the agent name
   * associated with the session.
   */
  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    // 1. Find the session boundary from sessions.jsonl
    const sessions = this.loadSessions();
    const session = sessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return [];
    }

    const sinceTs = since?.last_mulled_at
      ? new Date(since.last_mulled_at).getTime()
      : undefined;

    // 2. Find which JSONL files overlap this session's time range
    const messagesDir = join(this.dataDir, 'messages');
    if (!existsSync(messagesDir)) return [];

    const dateFiles = this.getDateFilesInRange(messagesDir, session.startedAt, session.endedAt);
    if (dateFiles.length === 0) return [];

    // 3. Stream through relevant files, extracting messages for this agent
    const entries: SessionEntry[] = [];

    for (const filePath of dateFiles) {
      const fileEntries = await this.parseMessageFile(
        filePath,
        session.agentName,
        session.startedAt,
        session.endedAt,
        sinceTs,
      );
      entries.push(...fileEntries);
    }

    // Sort by timestamp ascending
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return entries;
  }

  /**
   * List available sessions from the sessions.jsonl lifecycle log.
   * Filters out very short-lived sessions (< 1s) and system agents.
   */
  async listSessions(timeRange?: TimeRange): Promise<AdapterSessionInfo[]> {
    const sessions = this.loadSessions();

    const afterTs = timeRange?.after ? new Date(timeRange.after).getTime() : undefined;
    const beforeTs = timeRange?.before ? new Date(timeRange.before).getTime() : undefined;

    return sessions
      .filter(s => {
        // Skip system/status agents
        if (s.agentName === '__system__' || s.agentName === '__status__') return false;
        // Skip Dashboard sessions (not agent work)
        if (s.agentName === 'Dashboard') return false;

        // Time range filtering: include sessions that overlap the range
        if (afterTs !== undefined) {
          const endTs = s.endedAt ?? Date.now();
          if (endTs < afterTs) return false;
        }
        if (beforeTs !== undefined) {
          if (s.startedAt > beforeTs) return false;
        }

        return true;
      })
      .map(s => ({
        sessionId: s.sessionId,
        startedAt: new Date(s.startedAt).toISOString(),
        endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : undefined,
      }));
  }

  // ---------------------------------------------------------------------------
  // Private: sessions.jsonl parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse sessions.jsonl to build agent session boundaries.
   * Each session-start creates a new session; session-end closes it.
   */
  private loadSessions(): AgentSession[] {
    if (!existsSync(this.sessionsFile)) return [];

    const content = readFileSync(this.sessionsFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const sessionsMap = new Map<string, AgentSession>();

    for (const line of lines) {
      let event: SessionEvent;
      try {
        event = JSON.parse(line) as SessionEvent;
      } catch {
        continue; // skip malformed lines
      }

      if (event.type === 'session-start') {
        sessionsMap.set(event.session.id, {
          sessionId: event.session.id,
          agentName: event.session.agentName,
          startedAt: event.session.startedAt,
        });
      } else if (event.type === 'session-end') {
        const existing = sessionsMap.get(event.id);
        if (existing) {
          existing.endedAt = event.endedAt;
        }
      }
    }

    return [...sessionsMap.values()];
  }

  // ---------------------------------------------------------------------------
  // Private: JSONL message file parsing
  // ---------------------------------------------------------------------------

  /**
   * Get sorted paths to date-stamped JSONL files that overlap a time range.
   */
  private getDateFilesInRange(
    messagesDir: string,
    startTs: number,
    endTs?: number,
  ): string[] {
    const files = readdirSync(messagesDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .sort();

    // Convert session timestamps to date strings for comparison
    const startDate = this.tsToDateStr(startTs);
    const endDate = endTs ? this.tsToDateStr(endTs) : this.tsToDateStr(Date.now());

    return files
      .filter(f => {
        const fileDate = basename(f, '.jsonl');
        return fileDate >= startDate && fileDate <= endDate;
      })
      .map(f => join(messagesDir, f));
  }

  /**
   * Parse a single JSONL message file, extracting messages relevant to
   * a specific agent within a time window.
   *
   * Uses streaming line-by-line parsing to handle large files (up to 7MB+).
   */
  private async parseMessageFile(
    filePath: string,
    agentName: string,
    sessionStartTs: number,
    sessionEndTs: number | undefined,
    sinceTs: number | undefined,
  ): Promise<SessionEntry[]> {
    const entries: SessionEntry[] = [];
    const effectiveEndTs = sessionEndTs ?? Date.now();

    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      let envelope: MessageEnvelope;
      try {
        envelope = JSON.parse(line) as MessageEnvelope;
      } catch {
        continue; // skip malformed lines
      }

      // Only process message envelopes (skip status acks)
      if (envelope.type !== 'message' || !envelope.message) continue;

      const msg = envelope.message;

      // Skip system messages
      if (msg.from === '__system__') continue;

      // Time window filter
      if (msg.ts < sessionStartTs || msg.ts > effectiveEndTs) continue;

      // Cursor filter
      if (sinceTs !== undefined && msg.ts <= sinceTs) continue;

      // Agent relevance: include messages from or to this agent
      const isRelevant =
        msg.from === agentName ||
        msg.to === agentName ||
        // Also include channel messages the agent participates in
        (msg.to.startsWith('#') && (msg.from === agentName || msg.is_broadcast));

      if (!isRelevant) continue;

      entries.push(this.messageToEntry(msg));
    }

    return entries;
  }

  /**
   * Convert a relay message to a SessionEntry.
   *
   * Maps agent_status kind to 'event' type, everything else to 'message'.
   */
  private messageToEntry(msg: RelayMessage): SessionEntry {
    const timestamp = new Date(msg.ts).toISOString();

    if (msg.kind === 'agent_status') {
      return {
        timestamp,
        source: 'relay-daemon',
        type: 'event',
        content: {
          type: msg.kind,
          from: msg.from,
          to: msg.to,
          body: msg.body,
          data: msg.data,
        },
      };
    }

    // Regular message
    return {
      timestamp,
      source: 'relay-daemon',
      type: 'message',
      content: {
        role: msg.from,
        content: msg.body,
        to: msg.to,
        kind: msg.kind,
        is_urgent: msg.is_urgent,
        is_broadcast: msg.is_broadcast,
        data: msg.data,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private: helpers
  // ---------------------------------------------------------------------------

  /** Convert epoch ms to YYYY-MM-DD string for file matching. */
  private tsToDateStr(ts: number): string {
    return new Date(ts).toISOString().slice(0, 10);
  }
}
