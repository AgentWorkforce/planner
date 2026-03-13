// Domain types
export type {
  SessionRef,
  SessionMessage,
  SessionDecision,
  SessionEvent,
  SessionRetrospective,
  SessionData,
  AdapterConfig,
  MullConfig,
  MullOptions,
  ExtractedEntity,
  ExtractedFact,
  TopicMatch,
  FilteredExcerpt,
  PreExtract,
  NuggetCategory,
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
  DryRunDetails,
  DryRunEntity,
  DryRunFact,
  DryRunTopicMatch,
  DryRunNugget,
  TopicAbstract,
  TopicSummaryMap,
} from './domain/types.js';

export { SessionRefSchema, AdapterConfigSchema, MullConfigSchema } from './domain/types.js';

// Main pipeline functions
export { mull, type MullPipelineOptions } from './mull.js';
export { mullAll, type MullAllOptions } from './mull-all.js';

// Config
export { resolveConfig } from './config/resolve.js';
export { resolveAdapters, createAdapterFromFlags, mapToAdapterSpecificConfig } from './config/resolve-adapters.js';

// Pipeline steps
export { buildPreExtract } from './pipeline/extract.js';
export { synthesizeNuggets } from './pipeline/synthesize.js';
export { extractTrailDecisions } from './pipeline/extract-trail-decisions.js';
export { extractDryRunDetails } from './pipeline/extract-dry-run-details.js';

// CLI display
export { formatDryRunOutput } from './cli/format-dry-run.js';

// Routing
export { normalizeSessionRef, routeSessionRef } from './routing/session-ref-router.js';

// Adapter bridge (SessionAdapter → MullAdapter)
export { toMullAdapter, toMullAdapters, ADAPTER_REF_ROUTING, ADAPTER_SESSION_TYPE } from './adapters/adapter-bridge.js';

// Synthesizers
export { LlmSynthesizer, type LlmSynthesizerOptions } from './synthesizers/llm-synthesizer.js';

// Default implementations
export { FileTopicStore } from './defaults/topic-store.js';
export { readTopicFile, type TopicFrontmatter, type TopicFile } from './memory/read-topic-file.js';
export { computeHotness } from './memory/hotness.js';
export { PassthroughSynthesizer } from './defaults/passthrough-synthesizer.js';

// Real-time triggers
export {
  TriggerManager,
  type TriggerManagerEvents,
  registerMullTriggers,
  type RegisterTriggersConfig,
  type TriggerCleanupFn,
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
