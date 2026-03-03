/**
 * Source adapter module
 * Exports interfaces and types for integrating external data sources
 */

export type { SourceAdapter, AdapterType, SourceHealth, SourceHealthStatus, ReceiveRequest, AdapterEvent } from './adapter';
export { SourceHealthStatusSchema, SourceHealthSchema } from './adapter';

export { SourceHealthTracker } from './health-tracker';
export { PollApiAdapter } from './poll-api-adapter';
export { WebhookAdapter } from './webhook-adapter';
export { PushAdapter } from './push-adapter';
export { StructuredPullAdapter } from './structured-pull-adapter';
export { createAdapter } from './factory';
