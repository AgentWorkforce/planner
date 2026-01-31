import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PlanStatus } from '../types/plan';

export interface PlansFilter {
  status: PlanStatus | 'all';
  initiative_id: string | null;
  owner_user_id: string | null;
  search: string;
}

/**
 * Validate that a value is a valid PlanStatus or 'all'.
 */
function isValidStatus(value: unknown): value is PlanStatus | 'all' {
  return (
    value === 'all' ||
    value === 'draft' ||
    value === 'approved' ||
    value === 'published'
  );
}

/**
 * Hook to manage plans filter state with URL synchronization.
 *
 * - Reads filter params from URL search params
 * - Provides `setFilter` to update individual filter fields
 * - Provides `clearFilters` to reset all filters
 * - URL params are automatically updated when filters change
 *
 * URL param mapping:
 * - status → ?status=draft|approved|published|all
 * - initiative_id → ?initiative=<id>
 * - owner_user_id → ?owner=<id>
 * - search → ?q=<query>
 */
export function usePlansFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read current filter state from URL params
  const filter: PlansFilter = useMemo(() => {
    const statusParam = searchParams.get('status');
    const status = isValidStatus(statusParam) ? statusParam : 'all';

    return {
      status,
      initiative_id: searchParams.get('initiative') || null,
      owner_user_id: searchParams.get('owner') || null,
      search: searchParams.get('q') || '',
    };
  }, [searchParams]);

  // Update URL params with new filter values
  const setFilter = useCallback(
    (updates: Partial<PlansFilter>) => {
      const newParams = new URLSearchParams(searchParams);

      // Update status
      if (updates.status !== undefined) {
        if (updates.status === 'all') {
          newParams.delete('status');
        } else {
          newParams.set('status', updates.status);
        }
      }

      // Update initiative_id
      if (updates.initiative_id !== undefined) {
        if (updates.initiative_id === null || updates.initiative_id === '') {
          newParams.delete('initiative');
        } else {
          newParams.set('initiative', updates.initiative_id);
        }
      }

      // Update owner_user_id
      if (updates.owner_user_id !== undefined) {
        if (updates.owner_user_id === null || updates.owner_user_id === '') {
          newParams.delete('owner');
        } else {
          newParams.set('owner', updates.owner_user_id);
        }
      }

      // Update search
      if (updates.search !== undefined) {
        if (updates.search === '') {
          newParams.delete('q');
        } else {
          newParams.set('q', updates.search);
        }
      }

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // Clear all filters (reset to defaults)
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return { filter, setFilter, clearFilters };
}
