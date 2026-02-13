/**
 * Bridge between generic AdapterConfig (from config files / CLI flags)
 * and the adapter-specific config schemas expected by createAdapter().
 *
 * Generic config format:  { type: 'trajectory', dir: '.trajectories/' }
 * Specific config format: { dbPath: '.trajectories/' }
 *
 * This module handles the mapping between the two, so that config files
 * and CLI flags use a uniform shape while adapters get their validated configs.
 */

import { createAdapter } from '../adapters/factory.js';
import type { SessionAdapter, AdapterType } from '../adapters/core-types.js';
import type { MullConfig, AdapterConfig } from '../domain/types.js';

/**
 * Map a generic AdapterConfig to the specific config shape
 * expected by the adapter's Zod schema.
 *
 * The generic config uses `dir` as a universal path field.
 * Each adapter type maps it to its own config key:
 *   - trajectory  → { dbPath: dir }
 *   - relay       → { dataDir: dir }
 *   - relay-daemon → { dataDir: dir }
 *   - transcript  → { transcriptsDir: dir }
 *
 * Extra fields from .passthrough() are forwarded as-is.
 */
export function mapToAdapterSpecificConfig(
  generic: AdapterConfig,
): Record<string, unknown> {
  // Extract known generic fields; rest are passthrough
  const { type, dir, ...rest } = generic;

  switch (type) {
    case 'trajectory':
      return { dbPath: dir ?? '.trajectories/', ...rest };
    case 'relay':
      return { dataDir: dir ?? '.agent-relay/', ...rest };
    case 'relay-daemon':
      return { dataDir: dir ?? '.agent-relay/', ...rest };
    case 'transcript':
      return { transcriptsDir: dir ?? './transcripts/', ...rest };
    default:
      // Unknown adapter type — pass through everything and let factory validate
      return { dir, ...rest };
  }
}

/**
 * Create a SessionAdapter from CLI flags.
 *
 * Maps the user-facing --source/--dir/--path/--format flags to the
 * adapter-specific config shape and calls createAdapter().
 */
export function createAdapterFromFlags(
  source: string,
  dir?: string,
  path?: string,
  _format?: string,
): SessionAdapter {
  switch (source) {
    case 'trajectory':
      return createAdapter('trajectory' as AdapterType, {
        dbPath: dir ?? '.trajectories/',
      });
    case 'relay':
      return createAdapter('relay' as AdapterType, {
        dataDir: dir ?? '.agent-relay/',
      });
    case 'relay-daemon':
      return createAdapter('relay-daemon' as AdapterType, {
        dataDir: dir ?? '.agent-relay/',
      });
    case 'transcript':
      return createAdapter('transcript' as AdapterType, {
        transcriptsDir: path ?? './transcripts/',
      });
    default:
      throw new Error(
        `Unknown adapter source: '${source}'. ` +
        `Expected one of: trajectory, relay, relay-daemon, transcript`,
      );
  }
}

/**
 * Instantiate SessionAdapter[] from a resolved MullConfig's adapters array.
 *
 * For each generic AdapterConfig in config.adapters:
 *   1. Map to adapter-specific config shape
 *   2. Call createAdapter() to validate and instantiate
 *
 * @param config - Resolved MullConfig (from resolveConfig())
 * @returns Array of instantiated SessionAdapter instances
 */
export function resolveAdapters(config: MullConfig): SessionAdapter[] {
  return config.adapters.map((adapterConfig) => {
    const specificConfig = mapToAdapterSpecificConfig(adapterConfig);
    return createAdapter(adapterConfig.type as AdapterType, specificConfig);
  });
}
