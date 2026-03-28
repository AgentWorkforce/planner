import type { SessionAdapter, SessionEntry, Cursor, TimeRange, AdapterSessionInfo } from '../core-types.js';
import type { TranscriptAdapterConfig } from '../schemas.js';

/**
 * Reads session data from agent transcript files.
 * Provides raw agent reasoning and tool usage.
 */
export class TranscriptAdapter implements SessionAdapter {
  readonly type = 'transcript' as const;
  private readonly config: TranscriptAdapterConfig;

  constructor(config: TranscriptAdapterConfig) {
    this.config = config;
  }

  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    // Implementation will read transcript files from directory
    // Stub: returns empty until wired to actual file parsing
    void sessionId;
    void since;
    void this.config;
    return [];
  }

  async listSessions(_timeRange?: TimeRange): Promise<AdapterSessionInfo[]> {
    // Implementation will scan transcript directory for session files
    // Stub: returns empty until wired to actual file parsing
    void this.config;
    return [];
  }
}
