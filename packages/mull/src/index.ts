// Domain types
export type {
  SessionRef,
  SessionMessage,
  SessionData,
  AdapterConfig,
  MullConfig,
  MullOptions,
  PreExtract,
  Nugget,
  SynthesisResult,
  TopicMergeResult,
  MergeResult,
  MullResult,
  SessionProcessingResult,
  MullAllResult,
  PipelineStage,
  PipelineError,
  MullAdapter,
  NuggetSynthesizer,
  TopicStore,
} from './domain/types.js';

export { SessionRefSchema, AdapterConfigSchema, MullConfigSchema } from './domain/types.js';

// Main pipeline functions
export { mull, type MullPipelineOptions } from './mull.js';
export { mullAll, type MullAllOptions } from './mull-all.js';

// Config
export { resolveConfig } from './config/resolve.js';

// Pipeline steps
export { buildPreExtract } from './pipeline/extract.js';
export { synthesizeNuggets } from './pipeline/synthesize.js';
export { extractTrailDecisions } from './pipeline/extract-trail-decisions.js';

// Routing
export { normalizeSessionRef, routeSessionRef } from './routing/session-ref-router.js';

// Default implementations
export { FileTopicStore } from './defaults/topic-store.js';
export { PassthroughSynthesizer } from './defaults/passthrough-synthesizer.js';

// Real-time triggers
export {
  TriggerManager,
  type TriggerManagerEvents,
  type ForgeTrajectoryEvent,
  type PlannerDecisionEvent,
  type RelayMessageEvent,
  type TriggerConfig,
  type TriggerResult,
  type TriggerLayer,
  TriggerConfigSchema,
  HIGH_SIGNAL_FORGE_EVENTS,
  DECISION_EVENT_TYPES,
  SESSION_END_EVENTS,
} from './realtime/index.js';

// API layer
export * from './api/index.js';

// Service factory
export { createMullService, type MullServiceConfig, type MullService } from './service.js';
