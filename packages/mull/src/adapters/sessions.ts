/**
 * Cross-adapter session listing.
 *
 * listAllSessions queries all configured adapters for available sessions
 * and returns a deduplicated union. Each session entry includes the
 * adapter source(s) and optional time range.
 *
 * Deduplication is by sessionId — if multiple adapters report the same
 * session, their metadata (time ranges, adapter sources) is merged.
 */

import type { SessionAdapter, SessionInfo, TimeRange } from './core-types.js';

/**
 * List all sessions available across multiple adapters.
 *
 * Queries each adapter's listSessions() in parallel, then deduplicates
 * by sessionId. Adapters that don't implement listSessions are skipped.
 *
 * For sessions reported by multiple adapters:
 *  - adapters: union of all adapter types
 *  - startedAt: earliest start across adapters
 *  - endedAt: latest end across adapters
 *
 * @param adapters - Array of session adapters to query.
 * @param timeRange - Optional time range filter passed to each adapter.
 * @returns Deduplicated array of SessionInfo, sorted by startedAt descending
 *          (most recent first). Sessions without startedAt sort last.
 */
export async function listAllSessions(
  adapters: SessionAdapter[],
  timeRange?: TimeRange,
): Promise<SessionInfo[]> {
  // Filter to adapters that implement listSessions
  const listable = adapters.filter(
    (a): a is SessionAdapter & { listSessions: NonNullable<SessionAdapter['listSessions']> } =>
      typeof a.listSessions === 'function',
  );

  if (listable.length === 0) {
    return [];
  }

  // Query all adapters in parallel
  const adapterResults = await Promise.all(
    listable.map(async (adapter) => {
      const sessions = await adapter.listSessions(timeRange);
      return { adapterType: adapter.type, sessions };
    }),
  );

  // Deduplicate by sessionId, merging metadata across adapters
  const sessionMap = new Map<string, SessionInfo>();

  for (const { adapterType, sessions } of adapterResults) {
    for (const { sessionId, startedAt, endedAt } of sessions) {
      const existing = sessionMap.get(sessionId);

      if (existing) {
        // Merge adapter source
        if (!existing.adapters.includes(adapterType)) {
          existing.adapters.push(adapterType);
        }
        // Use earliest startedAt
        if (startedAt && (!existing.startedAt || startedAt < existing.startedAt)) {
          existing.startedAt = startedAt;
        }
        // Use latest endedAt
        if (endedAt && (!existing.endedAt || endedAt > existing.endedAt)) {
          existing.endedAt = endedAt;
        }
      } else {
        sessionMap.set(sessionId, {
          sessionId,
          adapters: [adapterType],
          startedAt,
          endedAt,
        });
      }
    }
  }

  // Sort by startedAt descending (most recent first), undefined last
  const results = Array.from(sessionMap.values());
  results.sort((a, b) => {
    if (!a.startedAt && !b.startedAt) return 0;
    if (!a.startedAt) return 1;
    if (!b.startedAt) return -1;
    return b.startedAt < a.startedAt ? -1 : b.startedAt > a.startedAt ? 1 : 0;
  });

  return results;
}
