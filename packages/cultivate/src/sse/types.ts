/**
 * SSE Event Types for Cultivate
 *
 * Defines all Server-Sent Event types and their payloads for real-time notifications
 * about signals, clusters, ingestion progress, and source health.
 */

/**
 * All SSE event names that Cultivate can emit
 */
export type CultivateSSEEvent =
  | 'signal:new'
  | 'signal:updated'
  | 'cluster:new'
  | 'cluster:updated'
  | 'cluster:trending'
  | 'ingestion:progress'
  | 'ingestion:complete'
  | 'source:error'
  | 'source:auth_expired';

/**
 * Payload for signal:new event
 * Emitted when a new signal is created
 */
export interface SignalNewPayload {
  signal_id: string;
  greenhouse_id: string;
  title: string;
  source_type: string;
}

/**
 * Payload for signal:updated event
 * Emitted when a signal's fields are modified
 */
export interface SignalUpdatedPayload {
  signal_id: string;
  fields_changed: string[];
}

/**
 * Payload for cluster:new event
 * Emitted when a new cluster is created
 */
export interface ClusterNewPayload {
  cluster_id: string;
  greenhouse_id: string;
  label: string;
}

/**
 * Payload for cluster:updated event
 * Emitted when a cluster's properties change
 */
export interface ClusterUpdatedPayload {
  cluster_id: string;
  signal_count: number;
  trend?: string;
}

/**
 * Payload for cluster:trending event
 * Emitted when a cluster is detected as trending
 */
export interface ClusterTrendingPayload {
  cluster_id: string;
  greenhouse_id: string;
  label: string;
  trend: string;
  velocity_weekly: number;
}

/**
 * Payload for ingestion:progress event
 * Emitted during document chunk ingestion
 */
export interface IngestionProgressPayload {
  job_id: string;
  processed_chunks: number;
  total_chunks: number;
}

/**
 * Payload for ingestion:complete event
 * Emitted when document ingestion job finishes
 */
export interface IngestionCompletePayload {
  job_id: string;
  signals_created: number;
}

/**
 * Payload for source:error event
 * Emitted when a source encounters an error
 */
export interface SourceErrorPayload {
  source_config_id: string;
  error: string;
  health: string;
}

/**
 * Payload for source:auth_expired event
 * Emitted when source authentication expires
 */
export interface SourceAuthExpiredPayload {
  source_config_id: string;
  name: string;
}

/**
 * Type-safe mapping of event names to their payload types
 */
export interface CultivateSSEPayloadMap {
  'signal:new': SignalNewPayload;
  'signal:updated': SignalUpdatedPayload;
  'cluster:new': ClusterNewPayload;
  'cluster:updated': ClusterUpdatedPayload;
  'cluster:trending': ClusterTrendingPayload;
  'ingestion:progress': IngestionProgressPayload;
  'ingestion:complete': IngestionCompletePayload;
  'source:error': SourceErrorPayload;
  'source:auth_expired': SourceAuthExpiredPayload;
}
