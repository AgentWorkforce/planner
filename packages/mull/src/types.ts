// Pipeline Type Schemas
// Core types for the mull extraction/synthesis/merge pipeline

import { z } from 'zod';
import { MessageSchema } from './adapters/types.js';

// --- Nugget Categories ---

export const NuggetCategory = {
  Decision: 'decision',
  Constraint: 'constraint',
  Pattern: 'pattern',
  Gotcha: 'gotcha',
  Context: 'context',
} as const;

export type NuggetCategory = (typeof NuggetCategory)[keyof typeof NuggetCategory];

export const NuggetCategorySchema = z.enum([
  'decision',
  'constraint',
  'pattern',
  'gotcha',
  'context',
]);

// --- Entity ---

export const EntitySchema = z.object({
  text: z.string().min(1),
  type: z.enum(['person', 'tool', 'concept', 'file', 'service', 'other']),
  count: z.number().int().positive().default(1),
});

export type Entity = z.infer<typeof EntitySchema>;

// --- Fact ---

export const FactSchema = z.object({
  slug: z.string().min(1),
  text: z.string().min(1),
  source: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  entities: z.array(z.string()).default([]),
  /** When true, this fact comes from pre-structured trail data and can bypass LLM synthesis */
  isPreStructured: z.boolean().optional(),
});

export type Fact = z.infer<typeof FactSchema>;

// --- Topic Match ---

export const TopicMatchSchema = z.object({
  topicSlug: z.string().min(1),
  score: z.number().min(0).max(1),
  /** Entity text strings that triggered this topic match */
  matchedEntities: z.array(z.string()).default([]),
});

export type TopicMatch = z.infer<typeof TopicMatchSchema>;

// --- Filtered Excerpt ---

export const FilteredExcerptSchema = z.object({
  messages: z.array(MessageSchema),
  anchorEvent: z.string().optional(),
  startTimestamp: z.string().datetime(),
  endTimestamp: z.string().datetime(),
  relevanceScore: z.number().min(0).max(1).optional(),
});

export type FilteredExcerpt = z.infer<typeof FilteredExcerptSchema>;

// --- Nugget ---

export const NuggetSchema = z.object({
  slug: z.string().min(1),
  category: NuggetCategorySchema,
  title: z.string().min(1),
  body: z.string().min(1),
  topicSlug: z.string().min(1),
  /** Human-readable slug of the nugget this one caused, for causal graph edges */
  caused: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type Nugget = z.infer<typeof NuggetSchema>;

// --- LLM Nugget Output (validation for LLM responses) ---

export const LlmNuggetOutputSchema = z.array(
  z.object({
    slug: z.string().min(1),
    category: NuggetCategorySchema,
    title: z.string().min(1),
    body: z.string().min(1),
    topicSlug: z.string().min(1),
    caused: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
);

export type LlmNuggetOutput = z.infer<typeof LlmNuggetOutputSchema>;

// --- Pre-Extract (stage boundary: deterministic before, LLM after) ---

export const PreExtractSchema = z.object({
  sessionId: z.string().min(1),
  entities: z.array(EntitySchema).default([]),
  facts: z.array(FactSchema).default([]),
  topicMatches: z.array(TopicMatchSchema).default([]),
  excerpts: z.array(FilteredExcerptSchema).default([]),
});

export type PreExtract = z.infer<typeof PreExtractSchema>;

// --- Merge Result ---

export const MergeResultSchema = z.object({
  topicSlug: z.string().min(1),
  nuggets: z.array(NuggetSchema).default([]),
  mergedFrom: z.array(z.string()).default([]),
  updatedAt: z.string().datetime(),
});

export type MergeResult = z.infer<typeof MergeResultSchema>;

// --- Topic File ---

export const TopicFileSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  sections: z.array(NuggetCategorySchema).default([]),
  nuggets: z.array(NuggetSchema).default([]),
  lastUpdated: z.string().datetime(),
});

export type TopicFile = z.infer<typeof TopicFileSchema>;

// --- Session Reference (discriminated union) ---

export const SessionIdRefSchema = z.object({
  type: z.literal('sessionId'),
  sessionId: z.string().min(1),
});

export const PlanIdRefSchema = z.object({
  type: z.literal('planId'),
  planId: z.string().min(1),
});

export const RunIdRefSchema = z.object({
  type: z.literal('runId'),
  runId: z.string().min(1),
});

export const ChannelRefSchema = z.object({
  type: z.literal('channel'),
  channel: z.string().min(1),
});

export const SessionRefSchema = z.discriminatedUnion('type', [
  SessionIdRefSchema,
  PlanIdRefSchema,
  RunIdRefSchema,
  ChannelRefSchema,
]);

export type SessionRef = z.infer<typeof SessionRefSchema>;

// --- Adapter Config (discriminated union) ---

export const TrajectoryAdapterConfigSchema = z.object({
  type: z.literal('trail'),
  basePath: z.string().min(1),
});

export const RelayAdapterConfigSchema = z.object({
  type: z.literal('relay'),
  relayUrl: z.string().min(1),
  channel: z.string().optional(),
});

export const TranscriptAdapterConfigSchema = z.object({
  type: z.literal('transcript'),
  filePath: z.string().min(1),
  format: z.enum(['jsonl', 'markdown', 'plain']).default('jsonl'),
});

export const ForgeAdapterConfigSchema = z.object({
  type: z.literal('forge'),
  dbPath: z.string().min(1),
  includeUserTrajectory: z.boolean().optional(),
  includePreferences: z.boolean().optional(),
});

export const CustomAdapterConfigSchema = z.object({
  type: z.literal('custom'),
  module: z.string().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const AdapterConfigSchema = z.discriminatedUnion('type', [
  TrajectoryAdapterConfigSchema,
  RelayAdapterConfigSchema,
  TranscriptAdapterConfigSchema,
  ForgeAdapterConfigSchema,
  CustomAdapterConfigSchema,
]);

export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;

// --- Mull Config (matches spec section 7) ---

export const MullConfigSchema = z.object({
  memoryDir: z.string().min(1),
  adapters: z.array(AdapterConfigSchema).min(1),
  llm: z.object({
    model: z.string().min(1),
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
  extraction: z.object({
    minEntitiesForLlm: z.number().int().nonnegative().default(3),
    categories: z.array(NuggetCategorySchema).default([
      'decision',
      'constraint',
      'pattern',
      'gotcha',
      'context',
    ]),
    topicMatchThreshold: z.number().min(0).max(1).default(0.6),
  }),
});

export type MullConfig = z.infer<typeof MullConfigSchema>;
