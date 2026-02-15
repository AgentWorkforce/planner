/**
 * Near-duplicate detection module
 *
 * Detects near-duplicate signals based on keyword overlap analysis.
 * Compares keywords from extracted signals to identify semantic duplicates
 * within the same cluster and source type.
 */

import type { Signal, ExtractionResult } from '../domain/types.js';
import type { CultivateStorage } from '../storage/interface.js';

/**
 * Compute keyword overlap as Jaccard similarity (intersection/union)
 * @param keywords1 - First set of keywords (normalized to lowercase)
 * @param keywords2 - Second set of keywords (normalized to lowercase)
 * @returns Overlap ratio from 0 to 1
 */
function computeKeywordOverlap(keywords1: Set<string>, keywords2: Set<string>): number {
  if (keywords1.size === 0 || keywords2.size === 0) {
    return 0;
  }

  const intersection = new Set([...keywords1].filter((k) => keywords2.has(k)));
  const union = new Set([...keywords1, ...keywords2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalize keywords to lowercase and deduplicate
 * @param keywords - Raw keywords array
 * @returns Normalized set of lowercase keywords
 */
function normalizeKeywords(keywords: string[]): Set<string> {
  return new Set(keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 0));
}

/**
 * Check for near-duplicate signals within the same cluster
 *
 * Queries signals in the same cluster from the same source_type created within
 * the last 7 days, computes keyword overlap (intersection/union) for each candidate,
 * and returns the original signal if overlap exceeds 0.8 threshold.
 *
 * Algorithm:
 * 1. Query candidates: same cluster, same source_type, created ≤7 days ago
 * 2. For each candidate, compute: overlap = |intersection| / |union| of keyword sets (case-insensitive)
 * 3. Return original signal if overlap > 0.8, else null
 *
 * @param signal - The signal being checked (provides cluster_id and source_type)
 * @param extraction - Extraction result containing keywords to compare
 * @param clusterId - The cluster ID to search within
 * @param storage - Storage instance for querying signals
 * @returns The near-duplicate signal if found (overlap > 0.8), null otherwise
 *
 * @example
 * ```typescript
 * const nearDup = await checkNearDuplicate(signal, extraction, clusterId, storage);
 * if (nearDup) {
 *   console.log(`Signal is near-duplicate of ${nearDup.id}`);
 * }
 * ```
 */
export async function checkNearDuplicate(
  signal: Signal,
  extraction: ExtractionResult,
  clusterId: string,
  storage: CultivateStorage
): Promise<Signal | null> {
  // Early exit: no cluster means no comparison possible
  if (!clusterId || !signal.source_type) {
    return null;
  }

  // No keywords to compare
  if (!extraction.keywords || extraction.keywords.length === 0) {
    return null;
  }

  // Normalize incoming keywords to lowercase for case-insensitive comparison
  const incomingKeywords = normalizeKeywords(extraction.keywords);

  if (incomingKeywords.size === 0) {
    return null;
  }

  // Query signals in the same cluster from the same source_type
  // Use a large limit to get all candidates for comparison
  const candidates = await storage.listSignals({
    cluster_id: clusterId,
    limit: 1000,
    offset: 0,
  });

  // Filter candidates by source_type and time window
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  const recentCandidates = candidates.filter(
    (candidate) =>
      candidate.source_type === signal.source_type &&
      candidate.id !== signal.id && // Don't compare with itself
      candidate.created_at >= sevenDaysAgoISO
  );

  // Check each candidate for near-duplicate match
  for (const candidate of recentCandidates) {
    // Retrieve extraction data for the candidate signal
    const candidateExtraction = await storage.getExtractionBySignalId(candidate.id);

    // Skip if candidate has no extraction
    if (!candidateExtraction || !candidateExtraction.keywords) {
      continue;
    }

    // Normalize candidate keywords
    const candidateKeywords = normalizeKeywords(candidateExtraction.keywords);

    // Compute overlap
    const overlap = computeKeywordOverlap(incomingKeywords, candidateKeywords);

    // Return the candidate if overlap exceeds threshold
    if (overlap > 0.8) {
      return candidate;
    }
  }

  // No near-duplicate found
  return null;
}
