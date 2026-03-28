/**
 * Merges session data from multiple adapters into a single SessionData.
 *
 * Merge strategy:
 * - messages: interleaved by timestamp (stable sort preserves order within same timestamp)
 * - events: interleaved by timestamp (stable sort preserves order within same timestamp)
 * - decisions: combined (union, deduplicated by id)
 * - retrospective: first non-null wins (adapter order = priority)
 * - artifacts: combined (union, deduplicated by id)
 * - metadata: merged with first adapter taking precedence for conflicting scalar fields
 */

import type { SessionData, SessionMetadata } from './core-types.js';

/**
 * Compare two ISO 8601 timestamps for sorting.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareTimestamps(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Merge multiple SessionData results from different adapters.
 *
 * @param results - Array of SessionData, one per adapter. Order matters:
 *                  earlier entries take precedence for scalar metadata fields
 *                  and retrospective (first non-null wins).
 * @returns A single merged SessionData.
 * @throws Error if results array is empty.
 */
export function mergeSessionData(results: SessionData[]): SessionData {
  if (results.length === 0) {
    throw new Error('mergeSessionData requires at least one SessionData result');
  }

  if (results.length === 1) {
    return results[0]!;
  }

  return {
    messages: mergeByTimestamp(results.map(r => r.messages)),
    events: mergeByTimestamp(results.map(r => r.events)),
    decisions: deduplicateById(results.flatMap(r => r.decisions)),
    retrospective: firstNonNull(results.map(r => r.retrospective)),
    artifacts: deduplicateById(results.flatMap(r => r.artifacts)),
    metadata: mergeMetadata(results.map(r => r.metadata)),
  };
}

/**
 * Interleave arrays of timestamped items, sorted ascending.
 * Uses stable sort so items with identical timestamps preserve their relative order.
 */
function mergeByTimestamp<T extends { timestamp: string }>(arrays: T[][]): T[] {
  const merged = arrays.flat();
  merged.sort((a, b) => compareTimestamps(a.timestamp, b.timestamp));
  return merged;
}

/**
 * Deduplicate items by `id`, keeping the first occurrence.
 */
function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

/**
 * Return the first non-null value, or null if all are null.
 */
function firstNonNull(values: (string | null)[]): string | null {
  for (const v of values) {
    if (v !== null) return v;
  }
  return null;
}

/**
 * Merge metadata objects. First adapter takes precedence for conflicting scalar fields.
 * Arrays and objects at the top level are not deep-merged — scalars win from the first source.
 */
function mergeMetadata(metadatas: SessionMetadata[]): SessionMetadata {
  // Start from the last and overlay earlier ones on top,
  // so the first metadata's fields take final precedence.
  const merged: Record<string, unknown> = {};

  // Apply in reverse order so first adapter's values overwrite last
  for (let i = metadatas.length - 1; i >= 0; i--) {
    const meta = metadatas[i]!;
    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
  }

  return merged as SessionMetadata;
}
