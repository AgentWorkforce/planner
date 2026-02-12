import type { SessionAdapter, SessionEntry, Cursor, TimeRange, AdapterSessionInfo } from '../core-types.js';
import type { RelayAdapterConfig } from '../schemas.js';

/**
 * Reads session data from relay JSONL message logs.
 * Provides inter-agent dialogue and channel messages.
 */
export class RelayJsonlAdapter implements SessionAdapter {
  readonly type = 'relay' as const;
  private readonly config: RelayAdapterConfig;

  constructor(config: RelayAdapterConfig) {
    this.config = config;
  }

  async read(sessionId: string, since?: Cursor): Promise<SessionEntry[]> {
    // Implementation will parse JSONL files from relay data directory
    // Stub: returns empty until wired to actual file parsing
    void sessionId;
    void since;
    void this.config;
    return [];
  }

  async listSessions(_timeRange?: TimeRange): Promise<AdapterSessionInfo[]> {
    // Implementation will scan JSONL files for distinct session IDs
    // Stub: returns empty until wired to actual file parsing
    void this.config;
    return [];
  }
}
