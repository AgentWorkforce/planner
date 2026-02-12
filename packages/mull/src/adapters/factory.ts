/**
 * Factory function for creating session adapters by type.
 *
 * Validates config against the appropriate Zod schema before
 * instantiating the adapter. Custom adapter objects implementing
 * SessionAdapter are passed through without validation.
 */

import { ZodError } from 'zod';
import { ValidationError } from '@plannr/errors';
import type { SessionAdapter, AdapterType } from './core-types.js';
import {
  adapterConfigSchemas,
  type TrajectoryAdapterConfig,
  type RelayAdapterConfig,
  type RelayDaemonAdapterConfig,
  type TranscriptAdapterConfig,
} from './schemas.js';
import { TrajectoryAdapter } from './implementations/trajectory-adapter.js';
import { RelayJsonlAdapter } from './implementations/relay-jsonl-adapter.js';
import { RelayDaemonAdapter } from './implementations/relay-daemon-adapter.js';
import { TranscriptAdapter } from './implementations/transcript-adapter.js';

/**
 * Check if a value looks like a SessionAdapter (duck typing).
 * Any object with a string `type` property and a `read` function qualifies.
 */
function isSessionAdapter(value: unknown): value is SessionAdapter {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SessionAdapter).type === 'string' &&
    typeof (value as SessionAdapter).read === 'function'
  );
}

/**
 * Create a session adapter by type string, or pass through a custom adapter object.
 *
 * @param typeOrAdapter - Adapter type string ('trajectory', 'relay', 'transcript')
 *                        or a custom object implementing SessionAdapter.
 * @param config - Configuration object validated against the adapter's Zod schema.
 *                 Not required when passing a custom adapter object.
 * @returns A SessionAdapter instance.
 * @throws ValidationError with Zod details if config is invalid.
 * @throws ValidationError if the adapter type is unknown.
 */
export function createAdapter(
  typeOrAdapter: AdapterType | SessionAdapter,
  config?: unknown,
): SessionAdapter {
  // Custom adapter object: pass through without validation
  if (typeof typeOrAdapter !== 'string') {
    if (isSessionAdapter(typeOrAdapter)) {
      return typeOrAdapter;
    }
    throw new ValidationError(
      'Custom adapter must implement SessionAdapter interface (type: string, read: function)',
    );
  }

  const adapterType = typeOrAdapter;
  const schema = adapterConfigSchemas[adapterType];

  if (!schema) {
    throw new ValidationError(
      `Unknown adapter type: '${adapterType}'. Expected one of: trajectory, relay, relay-daemon, transcript`,
    );
  }

  // Validate config against the adapter's Zod schema
  let validatedConfig: TrajectoryAdapterConfig | RelayAdapterConfig | RelayDaemonAdapterConfig | TranscriptAdapterConfig;
  try {
    validatedConfig = schema.parse(config);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ValidationError(
        `Invalid config for '${adapterType}' adapter`,
        err.errors,
      );
    }
    throw err;
  }

  // Instantiate the appropriate adapter
  switch (adapterType) {
    case 'trajectory':
      return new TrajectoryAdapter(validatedConfig as TrajectoryAdapterConfig);
    case 'relay':
      return new RelayJsonlAdapter(validatedConfig as RelayAdapterConfig);
    case 'relay-daemon':
      return new RelayDaemonAdapter(validatedConfig as RelayDaemonAdapterConfig);
    case 'transcript':
      return new TranscriptAdapter(validatedConfig as TranscriptAdapterConfig);
  }
}
