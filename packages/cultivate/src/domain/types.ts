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
