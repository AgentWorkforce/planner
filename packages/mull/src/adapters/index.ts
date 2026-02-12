// Types
export type {
  SessionAdapter, SessionEntry, Cursor, AdapterType,
  SessionData, SessionMessage, SessionEvent, SessionDecision, SessionArtifact, SessionMetadata,
  TimeRange, AdapterSessionInfo, SessionInfo,
} from './core-types.js';

// Schemas
export {
  TrajectoryAdapterConfigSchema,
  RelayAdapterConfigSchema,
  TranscriptAdapterConfigSchema,
  adapterConfigSchemas,
} from './schemas.js';
export type {
  TrajectoryAdapterConfig,
  RelayAdapterConfig,
  TranscriptAdapterConfig,
} from './schemas.js';

// Adapters
export { TrajectoryAdapter } from './implementations/trajectory-adapter.js';
export { RelayJsonlAdapter } from './implementations/relay-jsonl-adapter.js';
export { TranscriptAdapter } from './implementations/transcript-adapter.js';
export { ForgeDbAdapter } from './implementations/forge-db-adapter.js';
export type { ForgeDbAdapterConfig, UserTrajectoryEventRow, DerivedPreferenceRow } from './implementations/forge-db-adapter.js';

// Factory
export { createAdapter } from './factory.js';

// Merge
export { mergeSessionData } from './merge.js';

// Cursor persistence
export { getCursor, setCursor } from './cursor.js';

// Session loader
export { loadSessionFromAdapters, entriesToSessionData, sessionIdFromRef } from './loader.js';
export type { SessionRef, LoadSessionOptions } from './loader.js';

// Cross-adapter session listing
export { listAllSessions } from './sessions.js';
