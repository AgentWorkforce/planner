/**
 * Adapter factory function
 *
 * Creates the appropriate adapter instance based on source configuration
 */

import type { SourceConfig } from '../domain/types.js';
import type { SourceAdapter } from './adapter.js';
import { PollApiAdapter } from './poll-api-adapter.js';
import { WebhookAdapter } from './webhook-adapter.js';
import { PushAdapter } from './push-adapter.js';
import { StructuredPullAdapter } from './structured-pull-adapter.js';

/**
 * Create an adapter instance for the given source configuration
 *
 * @param config - Source configuration
 * @returns Adapter instance
 * @throws Error if adapter type is unknown
 */
export function createAdapter(config: SourceConfig): SourceAdapter {
  switch (config.adapter_type) {
    case 'poll_api':
      return new PollApiAdapter();

    case 'webhook':
      return new WebhookAdapter();

    case 'push':
      return new PushAdapter();

    case 'structured_pull':
      return new StructuredPullAdapter();

    default:
      throw new Error(`Unknown adapter type: ${config.adapter_type}`);
  }
}
