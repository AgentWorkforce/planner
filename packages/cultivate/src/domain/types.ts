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
