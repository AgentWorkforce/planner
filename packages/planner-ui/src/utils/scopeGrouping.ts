import type { PlanSummary } from '@/types';

export type ScopeGroupMap = Map<string, PlanSummary[]>;

const UNCATEGORIZED = 'Uncategorized';

/**
 * Group plans by their scope values.
 *
 * - Plans with scopes appear in each scope group they belong to
 * - Plans with undefined/empty scopes go to 'Uncategorized'
 * - Groups are sorted alphabetically with 'Uncategorized' last
 *
 * @param plans - Array of plan summaries
 * @returns Map where keys are scope names and values are arrays of plans
 */
export function groupPlansByScope(plans: PlanSummary[]): ScopeGroupMap {
  const groups = new Map<string, PlanSummary[]>();

  for (const plan of plans) {
    const scopes = plan.scopes;

    // No scopes or empty array -> Uncategorized
    if (!scopes || scopes.length === 0) {
      if (!groups.has(UNCATEGORIZED)) {
        groups.set(UNCATEGORIZED, []);
      }
      groups.get(UNCATEGORIZED)!.push(plan);
    } else {
      // Add plan to each scope it belongs to
      for (const scope of scopes) {
        if (!groups.has(scope)) {
          groups.set(scope, []);
        }
        groups.get(scope)!.push(plan);
      }
    }
  }

  // Sort groups alphabetically with Uncategorized last
  const sortedEntries = [...groups.entries()].sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  });

  return new Map(sortedEntries);
}

/**
 * Get unique scope names from a list of plans.
 */
export function getUniqueScopes(plans: PlanSummary[]): string[] {
  const scopes = new Set<string>();
  for (const plan of plans) {
    if (plan.scopes) {
      for (const scope of plan.scopes) {
        scopes.add(scope);
      }
    }
  }
  return [...scopes].sort();
}
