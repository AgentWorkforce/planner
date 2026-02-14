/**
 * Source adapter interface and types
 * Defines the contract for integrating various data sources (APIs, webhooks, etc.)
 */

import { z } from 'zod';
import type { SourceConfig } from '../domain/types';

/**
 * Source adapter type - integration pattern
 * Matches AdapterTypeSchema from domain/types.ts for consistency
 */
export type AdapterType = 'poll_api' | 'webhook' | 'push' | 'structured_pull';

/**
 * Source health status - current operational state of a source connection
 */
export const SourceHealthStatusSchema = z.enum([
  'healthy',
  'warn',
  'unhealthy',
  'disabled',
]);
export type SourceHealthStatus = z.infer<typeof SourceHealthStatusSchema>;

/**
 * Source health information with status and failure tracking
 * Provides visibility into source connection reliability
 */
export const SourceHealthSchema = z.object({
  status: SourceHealthStatusSchema,
  consecutive_failures: z.number().min(0),
  last_error: z.string().optional(),
});
export type SourceHealth = z.infer<typeof SourceHealthSchema>;

/**
 * Normalized request body for webhook/push adapters
 * Provides a consistent interface for receiving data from external sources
 */
export interface ReceiveRequest {
  /** Raw payload from the external source */
  payload: unknown;
  /** Optional headers from the request (e.g., for signature verification) */
  headers?: Record<string, string>;
  /** Timestamp when the request was received */
  receivedAt: string;
}

/**
 * Normalized event response from fetch/receive operations
 * Represents data ready for further processing in the pipeline
 */
export interface AdapterEvent {
  /** External source identifier for this event */
  externalId: string;
  /** Event title or subject */
  title: string;
  /** Event body or content */
  body: string;
  /** Author of the event */
  author: string;
  /** When the event occurred at the source */
  occurredAt: string;
  /** Optional URL reference to the original source */
  url?: string;
  /** Raw payload for debugging and audit */
  rawPayload: unknown;
}

/**
 * Source adapter interface - contract for all adapter implementations
 * Adapters are responsible for retrieving data from external sources and
 * normalizing it into a consistent format for pipeline processing
 */
export interface SourceAdapter {
  /**
   * Initialize the adapter with configuration
   * Called once at startup to validate credentials, test connectivity, etc.
   * @param config Source configuration including auth, endpoints, polling settings
   * @throws Error if initialization fails (e.g., invalid credentials, connectivity issues)
   */
  initialize(config: SourceConfig): Promise<void>;

  /**
   * Poll/pull for new data from the source
   * Only called for 'poll_api' and 'structured_pull' adapter types
   * Must respect poll_interval_ms from config
   * @returns Array of events retrieved from source, or empty array if no new data
   */
  fetch(): Promise<AdapterEvent[]>;

  /**
   * Receive data pushed from an external source
   * Only called for 'webhook' and 'push' adapter types
   * Validates and normalizes the incoming request
   * @param request Incoming request with payload and headers
   * @returns Array of events extracted from request (typically single event)
   * @throws Error if request is invalid or signature verification fails
   */
  receive(request: ReceiveRequest): Promise<AdapterEvent[]>;

  /**
   * Get current health status of the adapter/source connection
   * Should track failures and update status accordingly
   * @returns Current health information including status and failure counts
   */
  getHealth(): SourceHealth;
}
