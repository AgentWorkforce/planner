/**
 * Cultivate package exports
 */

// =============================================================================
// Plugin Service (for mounting in planner backend)
// =============================================================================

export { createCultivateService } from './service.js';
export type { CultivateServiceConfig } from './service.js';

// =============================================================================
// API Routes
// =============================================================================

export { createCultivateRouter } from './routes.js';

// =============================================================================
// Core Startup & Initialization
// =============================================================================

export { startCultivate } from './startup.js';
export { CultivateStorage } from './storage/index.js';
export { createSSEBroadcaster } from './sse/broadcaster.js';
export { createQueues } from './jobs/queues.js';
export { createWorkers } from './jobs/workers.js';

// =============================================================================
// Encryption & Security
// =============================================================================

export {
  encrypt,
  decrypt,
  initEncryption,
  validateEncryptionReady,
  isEncryptedCredential,
} from './auth/encryption.js';
export type { EncryptedCredential } from './auth/encryption.js';
export { CredentialManager } from './auth/credential-manager.js';

export {
  CultivateStartupError,
  CultivateInternalError,
  SignalFilteredError,
  SignalProcessingError,
} from './errors.js';

export type {
  CultivateStartupErrorCode,
  CultivateStartupDiagnostics,
  SignalMetadata,
} from './errors.js';

export {
  sanitizeConnectionInfo,
  formatStartupDiagnostics,
  isRetryableError,
} from './diagnostics.js';

// =============================================================================
// Signal Extraction
// =============================================================================

export { extractSignal } from './extraction/index.js';
export type { ExtractionContext } from './extraction/index.js';

// =============================================================================
// Signal Deduplication
// =============================================================================

export { checkNearDuplicate, checkExactDuplicate } from './dedup/index.js';

// =============================================================================
// Signal Scoring
// =============================================================================

export {
  scoreSignal,
  DEFAULT_WEIGHTS,
  resolveWeights,
  calcRecency,
  calcSpecificity,
  calcSourceAuthority,
  calcRepetition,
  calcEmotionalIntensity,
  calcStrategicFit,
  calcActionability,
  calcContentQuality,
} from './scoring/index.js';

export type { ScoringContext, ScoringResult, WeightOptions } from './scoring/index.js';

// =============================================================================
// Signal Clustering
// =============================================================================

export { assignCluster } from './clustering/index.js';
export type { ClusterAssignment, ClusteringContext } from './clustering/index.js';

// =============================================================================
// Signal Filtering
// =============================================================================

export { applyGreenhouseGate, FilterRuleRegistry } from './filters/index.js';
export type {
  GreenhouseGateSignal,
  GreenhouseGateRules,
  GreenhouseGateResult,
  FilterRuleFunction,
  FilterRuleResult,
  FilterRulesExecutionResult,
} from './filters/index.js';

// =============================================================================
// Source Presets
// =============================================================================

export {
  createSlackPreset,
  createDiscordPreset,
  createTeamsPreset,
  createCRMNotesPreset,
  createSalesCallPreset,
} from './presets/index.js';

export type {
  CultivateStartupConfig,
  CultivateContext,
  CultivateQueues,
  CultivateWorkers,
  SSEBroadcaster,
  CultivateService,
} from './types.js';

export type { CreateGreenhouseInput } from './storage/index.js';

// =============================================================================
// Domain Types & Zod Schemas
// =============================================================================

// Enums & Schemas
export {
  SignalStatusSchema,
  GreenhouseModeSchema,
  ClusterTrendSchema,
  AdapterTypeSchema,
  AuthorTypeSchema,
  AuthTypeSchema,
  FilterRuleTypeSchema,
  IngestionJobStatusSchema,
  SourceHealthSchema,
  ScoringFactorsSchema,
  CultivateWeightsSchema,
  CultivateConfigSchema,
  CultivateOutcomeSchema,
  RecommendationSchema,
  RawEventSchema,
  NormalizedEventSchema,
  ExtractionResultSchema,
  AuthConfigSchema,
  SourceConfigSchema,
  SourcePresetSchema,
  FilterRuleSchema,
  IngestionJobSchema,
  StepProvenanceSchema,
  SignalSchema,
  GreenhouseSchema,
  ClusterSchema,
} from './domain/types.js';

// Inferred Types
export type {
  SignalStatus,
  GreenhouseMode,
  ClusterTrend,
  AdapterType,
  AuthorType,
  AuthType,
  FilterRuleType,
  IngestionJobStatus,
  SourceHealth,
  ScoringFactors,
  CultivateWeights,
  CultivateConfig,
  CultivateOutcome,
  Recommendation,
  RawEvent,
  NormalizedEvent,
  ExtractionResult,
  AuthConfig,
  SourceConfig,
  SourcePreset,
  FilterRule,
  IngestionJob,
  StepProvenance,
  Signal,
  Greenhouse,
  Cluster,
} from './domain/types.js';
