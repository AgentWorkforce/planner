import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { listPlans, ApiError } from '@/api';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { PlansListSkeleton } from '@/components/AttentionSkeleton';
import { ScopeGroup } from '@/components/ScopeGroup';
import { PlanCard } from '@/components/PlanCard';
import { PlansToolbar } from '@/components/plans/PlansToolbar';
import { groupPlansByScope } from '@/utils/scopeGrouping';
import { useAttentionPlans, usePlansViewMode, useScopeGroupExpansion, useFuzzySearch, usePlansFilter, useCurrentUser } from '@/hooks';
import type { PlanSummary } from '@/types';

export function PlansListPage() {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state from URL params
  const { filter, setFilter } = usePlansFilter();

  // Determine if this is the "My Plans" view (/plans/my route)
  const isMyPlansView = location.pathname === '/plans/my';

  // Page title changes based on route
  const pageTitle = isMyPlansView ? 'My Plans' : 'Plans';

  // View mode persistence (list vs grouped)
  const { viewMode, setViewMode } = usePlansViewMode();

  // Scope group expansion state
  const { isExpanded, toggleExpansion, expandAll, collapseAll } = useScopeGroupExpansion();

  // Fetch all plans once (no filter - we need all plans for attention sections)
  useEffect(() => {
    async function fetchPlans() {
      setLoading(true);
      setError(null);
      try {
        const result = await listPlans();
        setPlans(result.plans);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load plans');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  // Categorize plans (allOther excludes in-progress work)
  const { allOther } = useAttentionPlans(plans);

  // Filter plans for the "All Plans" section
  const filteredPlans = useMemo(() => {
    let filtered = allOther;

    // For /plans/my view, filter by current user FIRST (ignore URL owner param)
    if (isMyPlansView && currentUser) {
      filtered = filtered.filter((plan) => plan.owner_user_id === currentUser.user_id);
    } else if (filter.owner_user_id && !isMyPlansView) {
      // Only apply URL owner_user_id filter if NOT in /plans/my view
      filtered = filtered.filter((plan) => plan.owner_user_id === filter.owner_user_id);
    }

    // Filter by status
    if (filter.status !== 'all') {
      filtered = filtered.filter((plan) => plan.status === filter.status);
    }

    // Filter by initiative_id
    if (filter.initiative_id) {
      filtered = filtered.filter((plan) => plan.initiative_id === filter.initiative_id);
    }

    return filtered;
  }, [allOther, filter.status, filter.initiative_id, filter.owner_user_id, isMyPlansView, currentUser]);

  // Fuzzy search results
  const searchResults = useFuzzySearch(filteredPlans, filter.search);

  // Plans to display (search results or all filtered)
  const displayPlans = useMemo(() => {
    if (filter.search.trim()) {
      return searchResults.map((r) => r.plan);
    }
    return filteredPlans;
  }, [filter.search, searchResults, filteredPlans]);

  // Group plans by scope for grouped view
  const scopeGroups = useMemo(() => groupPlansByScope(displayPlans), [displayPlans]);

  // Get sorted scope names (Uncategorized last)
  const sortedScopeNames = useMemo(() => {
    const names = Array.from(scopeGroups.keys());
    return names.sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
  }, [scopeGroups]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <PlansToolbar
        title={pageTitle}
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
        {loading && <PlansListSkeleton />}

        {error && (
          <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {/* Empty state - no plans at all */}
        {!loading && !error && plans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-text-secondary font-medium mb-2">No plans yet</p>
            <p className="text-sm text-text-muted">
              Create your first plan using the "+ New Plan" button above.
            </p>
          </div>
        )}

        {/* Attention sections - only shown when plans exist */}
        {!loading && !error && plans.length > 0 && (
          <div className="space-y-4">
            {/* All Plans section */}
            <CollapsibleSection
              sectionId="all-plans"
              title="All Plans"
              count={allOther.length}
            >
              {/* Plans display */}
              {displayPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 mb-3 rounded-full bg-bg-tertiary flex items-center justify-center">
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <p className="text-text-secondary font-medium">
                    {filter.search.trim() ? 'No matching plans' : 'No plans found'}
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    {filter.search.trim()
                      ? 'Try adjusting your search terms'
                      : `No ${filter.status === 'all' ? '' : filter.status + ' '}plans in this category`}
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                /* List view */
                <ul className="space-y-2.5">
                  {displayPlans.map((plan) => (
                    <li key={plan.plan_id}>
                      <PlanCard plan={plan} />
                    </li>
                  ))}
                </ul>
              ) : (
                /* Grouped view */
                <div>
                  {/* Expand/Collapse all controls */}
                  <div className="flex items-center gap-1 mb-4 pl-1">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="px-2 py-1 text-xs text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/5 rounded transition-colors"
                    >
                      Expand all
                    </button>
                    <span className="text-text-dim/50">|</span>
                    <button
                      type="button"
                      onClick={() => collapseAll(sortedScopeNames)}
                      className="px-2 py-1 text-xs text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/5 rounded transition-colors"
                    >
                      Collapse all
                    </button>
                  </div>
                  <div className="space-y-1">
                    {sortedScopeNames.map((scopeName) => {
                      const scopePlans = scopeGroups.get(scopeName) || [];
                      return (
                        <ScopeGroup
                          key={scopeName}
                          scopeName={scopeName}
                          plans={scopePlans}
                          isExpanded={isExpanded(scopeName)}
                          onToggle={() => toggleExpansion(scopeName)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </CollapsibleSection>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
