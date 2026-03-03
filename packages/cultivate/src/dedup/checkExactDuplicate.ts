/**
 * Exact duplicate detection module
 *
 * Checks for exact duplicate signals based on source_type and external_id combination.
 * Uses the unique composite index (source_type, external_id) to efficiently detect
 * already-processed signals before the pipeline.
 */

import type { AdapterType } from '../domain/types.js';
import type { CultivateStorage } from '../storage/interface.js';

/**
 * Check for an exact duplicate signal
 *
 * Used to reject already-processed signals before the pipeline. Queries the storage
 * for an existing signal with the same source_type and external_id combination.
 *
 * This runs before filter rules and extraction to immediately detect if a signal
 * has already been ingested, preventing redundant processing.
 *
 * @param source_type - The source adapter type (e.g., 'slack', 'twitter', 'webhook')
 * @param external_id - The external identifier from the source system
 * @param storage - Storage instance for querying signals
 * @returns The existing signal ID if duplicate found, null otherwise
 *
 * @example
 * ```typescript
 * const duplicateId = await checkExactDuplicate('slack', 'msg-12345', storage);
 * if (duplicateId) {
 *   console.log(`Signal is exact duplicate of ${duplicateId}`);
 *   return; // Skip processing
 * }
 * ```
 */
export async function checkExactDuplicate(
  source_type: AdapterType,
  external_id: string,
  storage: CultivateStorage
): Promise<string | null> {
  return storage.checkExactDuplicate(source_type, external_id);
}
