/**
 * Source adapter module
 * Exports interfaces and types for integrating external data sources
 */

export type { SourceAdapter, AdapterType, SourceHealth, SourceHealthStatus, ReceiveRequest, AdapterEvent } from './adapter';
export { SourceHealthStatusSchema, SourceHealthSchema } from './adapter';
