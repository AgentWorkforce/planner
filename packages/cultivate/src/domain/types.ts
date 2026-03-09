/**
 * Cultivate domain types - Core enums and primitive types
 */

import { z } from 'zod';

/**
 * Signal processing lifecycle status
 */
export const SignalStatusSchema = z.enum([
  'pending',
  'filtered',
  'processing',
  'scored',
  'clustered',
  'decayed',
  'dead_lettered',
]);
export type SignalStatus = z.infer<typeof SignalStatusSchema>;

/**
 * Greenhouse operational mode
 */
export const GreenhouseModeSchema = z.enum([
  'discovery',
  'refinement',
  'focused',
]);
export type GreenhouseMode = z.infer<typeof GreenhouseModeSchema>;

/**
 * Cluster growth/decline trend
 */
export const ClusterTrendSchema = z.enum([
  'rising',
  'stable',
  'declining',
]);
export type ClusterTrend = z.infer<typeof ClusterTrendSchema>;

/**
 * Source adapter integration pattern
 */
export const AdapterTypeSchema = z.enum([
  'poll_api',
  'webhook',
  'push',
  'structured_pull',
]);
export type AdapterType = z.infer<typeof AdapterTypeSchema>;

/**
 * Signal author classification
 */
export const AuthorTypeSchema = z.enum([
  'user',
  'team',
  'bot',
  'system',
  'unknown',
]);
export type AuthorType = z.infer<typeof AuthorTypeSchema>;

export const IntentSchema = z.enum([
  'product_feedback',
  'bug_report',
  'feature_request',
  'question',
  'noise',
  'unclassified',
]);
export type IntentType = z.infer<typeof IntentSchema>;

/**
 * Authentication mechanism type
 */
export const AuthTypeSchema = z.enum([
  'bearer',
  'api_key',
  'oauth2',
  'basic',
  'hmac',
]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

/**
 * Filter rule action type
 */
export const FilterRuleTypeSchema = z.enum([
  'reject',
  'boost',
]);
export type FilterRuleType = z.infer<typeof FilterRuleTypeSchema>;

/**
 * Document ingestion job lifecycle status
 */
export const IngestionJobStatusSchema = z.enum([
  'pending',
  'chunking',
  'processing',
  'complete',
  'failed',
]);
export type IngestionJobStatus = z.infer<typeof IngestionJobStatusSchema>;

/**
 * Source connection health status
 */
export const SourceHealthSchema = z.enum([
  'healthy',
  'warning',
  'unhealthy',
  'disabled',
]);
export type SourceHealth = z.infer<typeof SourceHealthSchema>;

/**
 * Signal scoring weight factors (all values 0-1)
 */
export const ScoringFactorsSchema = z.object({
  recency: z.number().min(0).max(1),
  specificity: z.number().min(0).max(1),
  source_authority: z.number().min(0).max(1),
  repetition: z.number().min(0).max(1),
  emotional_intensity: z.number().min(0).max(1),
  strategic_fit: z.number().min(0).max(1),
  actionability: z.number().min(0).max(1),
  content_quality: z.number().min(0).max(1),
});
export type ScoringFactors = z.infer<typeof ScoringFactorsSchema>;

/**
 * Cultivate weights - same keys as ScoringFactors but as weight multipliers (unbounded)
 */
export const CultivateWeightsSchema = z.object({
  recency: z.number(),
  specificity: z.number(),
  source_authority: z.number(),
  repetition: z.number(),
  emotional_intensity: z.number(),
  strategic_fit: z.number(),
  actionability: z.number(),
  content_quality: z.number(),
});
export type CultivateWeights = z.infer<typeof CultivateWeightsSchema>;

/**
 * Cultivate configuration with per-greenhouse weights and tuning parameters
 */
export const CultivateConfigSchema = z.object({
  weights: z.record(z.string(), CultivateWeightsSchema), // keyed by greenhouse_id
  filter_rules: z.record(z.string(), z.object({ enabled: z.boolean() })), // keyed by rule_id
  tier1_strictness: z.number(),
  tier2_enabled: z.boolean().optional(), // Whether to use ML classifier (default: false)
  tier2_threshold: z.number(),
  extract_model: z.string().optional(),
  cluster_model: z.string().optional(),
});
export type CultivateConfig = z.infer<typeof CultivateConfigSchema>;

/**
 * User action outcome for a signal (link to plan or dismiss)
 */
export const CultivateOutcomeSchema = z.object({
  signal_id: z.string(),
  action: z.enum(['link', 'dismiss']),
  greenhouse_id: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});
export type CultivateOutcome = z.infer<typeof CultivateOutcomeSchema>;

/**
 * AI-generated recommendation for signal exploration
 */
export const RecommendationSchema = z.object({
  id: z.string(),
  greenhouse_id: z.string(),
  title: z.string(),
  reasoning: z.string(),
  confidence: z.number(),
  supporting_signal_ids: z.array(z.string()),
  supporting_cluster_ids: z.array(z.string()),
  created_at: z.string(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Raw event from source adapter (before normalization)
 */
export const RawEventSchema = z.object({
  source_config_id: z.string(),
  external_id: z.string(),
  raw_payload: z.unknown(), // Accepts any JSON from source
  received_at: z.string(),
});
export type RawEvent = z.infer<typeof RawEventSchema>;

/**
 * Normalized event after adapter transformation (validated contract for pipeline entry)
 */
export const NormalizedEventSchema = z.object({
  title: z.string(),
  body: z.string(),
  author: z.string(),
  author_type: AuthorTypeSchema,
  url: z.string().optional(),
  source_type: AdapterTypeSchema,
  external_id: z.string(),
  occurred_at: z.string(),
});
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

/**
 * Entity structure within extraction results
 * Represents a named entity with its classification type
 */
const EntitySchema = z.object({
  name: z.string().describe('Entity name or value'),
  type: z.string().describe('Entity type classification (e.g., PERSON, ORGANIZATION, LOCATION)'),
});

/**
 * Question extracted from signal content
 * Represents either an explicit question asked or an implicit question inferred
 */
export const QuestionSchema = z.object({
  text: z.string().describe('The question text'),
  is_explicit: z.boolean().describe('Whether the question was explicitly asked vs inferred'),
});
export type Question = z.infer<typeof QuestionSchema>;

/**
 * Sentiment classification for signal content
 */
export const SentimentSchema = z.enum([
  'frustrated',
  'disappointed',
  'neutral',
  'hopeful',
  'enthusiastic',
]);
export type Sentiment = z.infer<typeof SentimentSchema>;

/**
 * Extraction result containing analyzed signal data
 * Produced by extraction jobs and used for clustering and analysis
 */
export const ExtractionResultSchema = z.object({
  summary: z.string().describe('Brief summary of the extracted content'),
  keywords: z.array(z.string()).describe('List of key terms and phrases extracted from content'),
  entities: z.array(EntitySchema).describe('Named entities found in content with their types'),
  aspects: z.array(z.string()).describe('Key aspects, themes, or dimensions discussed'),
  quotes: z.array(z.string()).describe('Notable direct quotes from the source'),
  questions: z.array(QuestionSchema).default([]).describe('Questions extracted from the signal — explicit or inferred'),
  reasoning: z.string().describe('AI reasoning explaining the extraction choices and key findings'),
  specificity: z.number().min(0).max(1).describe('Score 0-1 indicating how specific/general the content is'),
  emotional_intensity: z.number().min(0).max(1).describe('Score 0-1 indicating emotional charge or intensity'),
  actionability: z.number().min(0).max(1).describe('Score 0-1 indicating how actionable the signal is'),
  sentiment: SentimentSchema.default('neutral').describe('Overall sentiment of the signal author'),
});

/**
 * TypeScript type inferred from ExtractionResultSchema
 * Use this for type annotations in functions and data structures
 */
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Authentication configuration (opaque encrypted credentials)
 */
export const AuthConfigSchema = z.object({
  type: AuthTypeSchema,
  encrypted_credentials: z.string(), // Opaque string - actual encryption handled by auth-encryption feature
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

/**
 * Source configuration with health monitoring and adapter settings
 */
export const SourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter_type: AdapterTypeSchema,
  preset: z.string().optional(),
  endpoint_template: z.string().optional(),
  auth: AuthConfigSchema.optional(),
  poll_interval_ms: z.number(),
  greenhouse_ids: z.array(z.string()),
  health: SourceHealthSchema,
  consecutive_failures: z.number(),
  last_error: z.string().optional(),
  enabled: z.boolean(),
  created_at: z.string(),
});
export type SourceConfig = z.infer<typeof SourceConfigSchema>;

/**
 * Input field definition for adapter configuration
 * Represents a required or optional input parameter for a source adapter
 */
export const InputFieldSchema = z.object({
  key: z.string().describe('Unique identifier for the input field'),
  label: z.string().describe('Human-readable label for the input field'),
  type: z.string().describe('Data type of the input (e.g., string, number, url, password)'),
  description: z.string().describe('Detailed description of what this input is used for'),
  default: z.unknown().optional().describe('Optional default value for this input'),
});

export type InputField = z.infer<typeof InputFieldSchema>;

/**
 * Source preset configuration template for adapter integration
 * Defines the structure and requirements for a reusable source adapter configuration
 */
export const SourcePresetSchema = z.object({
  name: z.string().describe('Human-readable name of the preset'),
  adapter_type: AdapterTypeSchema.describe('Type of adapter this preset is for'),
  description: z.string().describe('Detailed description of the preset and its purpose'),
  required_inputs: z.array(InputFieldSchema).describe('Array of required input fields for configuring this adapter'),
  optional_inputs: z.array(InputFieldSchema).describe('Array of optional input fields with sensible defaults'),
  defaults: z.record(z.unknown()).describe('Pre-configured default values for adapter settings'),
  channel_authority: z.number().min(0).max(1).describe('Source tier weight (0-1) representing channel authority/credibility'),
});

export type SourcePreset = z.infer<typeof SourcePresetSchema>;

/**
 * Filter rule with effectiveness tracking
 */
export const FilterRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: FilterRuleTypeSchema,
  condition: z.string(),
  enabled: z.boolean(),
  effectiveness: z.object({
    signals_matched: z.number(),
    false_positive_rate: z.number(),
  }),
});
export type FilterRule = z.infer<typeof FilterRuleSchema>;

/**
 * Document ingestion job tracking
 */
export const IngestionJobSchema = z.object({
  id: z.string(),
  filename: z.string(),
  status: IngestionJobStatusSchema,
  total_chunks: z.number(),
  processed_chunks: z.number(),
  greenhouse_id: z.string(),
  created_at: z.string(),
});
export type IngestionJob = z.infer<typeof IngestionJobSchema>;

/**
 * Pipeline stage progression tracking for signals
 */
export const StepProvenanceSchema = z.object({
  step: z.string(), // Pipeline stage name (e.g., 'filter', 'extract', 'score', 'cluster')
  timestamp: z.string(), // ISO 8601 timestamp
  details: z.record(z.unknown()).optional(), // Optional metadata about the step
});
export type StepProvenance = z.infer<typeof StepProvenanceSchema>;

/**
 * Signal - Core entity representing a single captured signal from a source
 */
export const SignalSchema = z.object({
  id: z.string(),
  greenhouse_id: z.string(),
  source_type: AdapterTypeSchema,
  external_id: z.string(),
  title: z.string(),
  body: z.string(),
  author: z.string(),
  author_type: AuthorTypeSchema,
  url: z.string().optional(),
  score: z.number(),
  scoring_factors: ScoringFactorsSchema,
  cluster_id: z.string().optional(),
  status: SignalStatusSchema,
  provenance: z.array(StepProvenanceSchema), // Pipeline stage history
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  linked_plan_id: z.string().optional(),
  intent: IntentSchema.optional(),
});
export type Signal = z.infer<typeof SignalSchema>;

/**
 * Greenhouse - Topic-based signal collection with filtering criteria
 */
export const GreenhouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mode: GreenhouseModeSchema,
  keyword_require: z.array(z.string()), // All required keywords
  keyword_exclude: z.array(z.string()), // Exclusion keywords
  source_ids: z.array(z.string()), // Connected source configurations
  weight_overrides: CultivateWeightsSchema.partial().optional(), // Per-greenhouse scoring weight overrides
  created_at: z.string(),
  updated_at: z.string(),
});
export type Greenhouse = z.infer<typeof GreenhouseSchema>;

/**
 * Cluster - Grouped signals with shared themes/patterns
 */
export const ClusterSchema = z.object({
  id: z.string(),
  greenhouse_id: z.string(),
  label: z.string(), // Human-readable cluster label
  summary: z.string(), // AI-generated summary of cluster themes
  signal_count: z.number(),
  trend: ClusterTrendSchema,
  velocity_weekly: z.number(), // Signals per week
  velocity_monthly: z.number(), // Signals per month
  created_at: z.string(),
  updated_at: z.string(),
});
export type Cluster = z.infer<typeof ClusterSchema>;
