import { useMemo } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { PlanSummary } from '@/types';

/**
 * Fuse.js options for plan searching.
 * - Searches goal, scope fields
 * - Threshold 0.4 allows fuzzy matches (0 = exact, 1 = anything)
 * - ignoreLocation allows matches anywhere in string
 */
const FUSE_OPTIONS: IFuseOptions<PlanSummary> = {
  keys: [
    { name: 'goal', weight: 2 },
    { name: 'scopes', weight: 1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
};

export interface FuzzySearchResult {
  plan: PlanSummary;
  score: number;
}

/**
 * Hook that provides fuzzy search over plans using fuse.js.
 *
 * - Memoizes Fuse instance to avoid recreating on every render
 * - Returns empty array if query is empty
 * - Sorts results by relevance score (lower = better match)
 * - Searches goal (weight 2) and scopes (weight 1)
 */
export function useFuzzySearch(plans: PlanSummary[], query: string): FuzzySearchResult[] {
  // Memoize Fuse instance - only recreate when plans change
  const fuse = useMemo(() => new Fuse(plans, FUSE_OPTIONS), [plans]);

  // Memoize search results - only re-run when fuse or query changes
  const results = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const fuseResults = fuse.search(trimmedQuery);

    return fuseResults.map((result) => ({
      plan: result.item,
      score: result.score ?? 1,
    }));
  }, [fuse, query]);

  return results;
}
