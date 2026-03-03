/**
 * Cultivate startup configuration and context types
 */

import type { Redis } from 'ioredis';
import type { Queue, Worker } from 'bullmq';
import type { Router } from 'express';
import type Anthropic from '@anthropic-ai/sdk';
import type { FilterRuleRegistry } from './filters/rule-registry.js';

// Re-export CultivateStorage for external use
export type { CultivateStorage } from './storage/interface.js';

/**
 * Configuration required to start Cultivate
 */
export interface CultivateStartupConfig {
  /** Redis connection string or options */
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  /** SQLite database path */
  dbPath: string;
  /** Anthropic API key */
  anthropicApiKey: string;
  /** Tuner service URL (optional - falls back to defaults) */
  tunerUrl?: string;
  /** Secret for encrypting source credentials */
  encryptionSecret: string;
  /** Model name for extraction (default: claude-sonnet-4-latest) */
  extractModel?: string;
  /** Model name for clustering (default: claude-haiku-4-latest) */
  clusterModel?: string;
}

/**
 * Initialized Cultivate context containing all dependencies
 * for injection into router and workers
 */
export interface CultivateContext {
  /** Redis connection */
  redis: Redis;
  /** Storage instance */
  storage: any; // Will be CultivateStorage when implemented
  /** Transformers.js zero-shot classifier model */
  mlModel: any; // Will be typed when Transformers.js is integrated
  /** Anthropic SDK client */
  anthropic: Anthropic;
  /** Tuner configuration */
  tunerConfig: CultivateConfig | null;
  /** SSE broadcaster */
  sseBroadcaster: SSEBroadcaster;
  /** BullMQ queues */
  queues: CultivateQueues;
  /** BullMQ workers */
  workers: CultivateWorkers;
  /** Configuration used at startup */
  config: CultivateStartupConfig;
  /** Filter rule registry for Tier 1 signal filtering */
  filterRegistry: FilterRuleRegistry;
}

/**
 * BullMQ queue instances
 */
export interface CultivateQueues {
  pollSources: Queue;
  processSignal: Queue;
  ingestDocument: Queue;
  recluster: Queue;
  decay: Queue;
  trendDetect: Queue;
}

/**
 * BullMQ worker instances
 */
export interface CultivateWorkers {
  pollSources: Worker;
  processSignal: Worker;
  ingestDocument: Worker;
  recluster: Worker;
  decay: Worker;
  trendDetect: Worker;
}

/**
 * Tuner configuration structure
 */
export interface CultivateConfig {
  weights: Record<string, CultivateWeights>; // keyed by greenhouse_id
  filter_rules: Record<string, { enabled: boolean }>; // keyed by rule_id
  tier1_strictness: number;
  tier2_enabled?: boolean; // Whether to use ML classifier (default: false)
  tier2_threshold: number;
  extract_model?: string;
  cluster_model?: string;
}

/**
 * Scoring weights per greenhouse
 */
export interface CultivateWeights {
  recency: number;
  specificity: number;
  source_authority: number;
  repetition: number;
  emotional_intensity: number;
  strategic_fit: number;
  actionability: number;
  content_quality: number;
}

/**
 * SSE broadcaster for real-time events
 */
export interface SSEBroadcaster {
  start(): void;
  stop(): void;
  addClient(res: any): () => void;
  removeClient(res: any): void;
  readonly clientCount: number;
  emit(event: string, data: any): void;
  emitSignalNew(payload: any): void;
  emitSignalUpdated(payload: any): void;
  emitClusterNew(payload: any): void;
  emitClusterUpdated(payload: any): void;
  emitClusterTrending(payload: any): void;
  emitIngestionProgress(payload: any): void;
  emitIngestionComplete(payload: any): void;
  emitSourceError(payload: any): void;
  emitSourceAuthExpired(payload: any): void;
}

/**
 * Plugin service interface
 */
export interface CultivateService {
  router: Router;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getContext?: () => CultivateContext | undefined;
}

/**
 * Factory function to create SSE broadcaster instance
 */
export { createSSEBroadcaster } from './sse/broadcaster.js';
