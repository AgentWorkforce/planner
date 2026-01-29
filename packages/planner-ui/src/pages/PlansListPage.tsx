import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listPlans, ApiError } from '@/api';
import { PlusIcon } from '@/components/icons';
import { NeedsAttentionSection } from '@/components/NeedsAttentionSection';
import { WorkingOnSection } from '@/components/WorkingOnSection';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { PlansListSkeleton } from '@/components/AttentionSkeleton';
import { PlansViewModeToggle } from '@/components/PlansViewModeToggle';
import { ScopeGroup } from '@/components/ScopeGroup';
import { PlanCard } from '@/components/PlanCard';
import { groupPlansByScope } from '@/utils/scopeGrouping';
import { useAttentionPlans, usePlansViewMode, useScopeGroupExpansion, useFuzzySearch } from '@/hooks';
import type { PlanSummary, PlanStatus } from '@/types';

type FilterOption = PlanStatus | 'all';

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
];

export function PlansListPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Categorize plans for attention sections
  const { needsAttention, workingOn, allOther } = useAttentionPlans(plans);

  // Filter plans for the "All Plans" section
  const filteredPlans = useMemo(() => {
    if (filter === 'all') return allOther;
    return allOther.filter((plan) => plan.status === filter);
  }, [allOther, filter]);

  // Fuzzy search results
  const searchResults = useFuzzySearch(filteredPlans, searchQuery);

  // Plans to display (search results or all filtered)
  const displayPlans = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults.map((r) => r.plan);
    }
    return filteredPlans;
  }, [searchQuery, searchResults, filteredPlans]);

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
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border-subtle bg-bg-card/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-7">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold text-text-primary">Plans</h1>
              <p className="mt-1.5 text-sm text-text-muted">
                Create and manage execution plans for the Orchestrator
              </p>
            </div>
            <Link
              to="/plans/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan active:scale-[0.98]"
            >
              <PlusIcon size="sm" />
              New Plan
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
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
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-bg-tertiary to-bg-card border border-border-subtle flex items-center justify-center">
              <PlusIcon size="xl" className="text-text-muted" />
            </div>
            <h2 className="text-xl font-display font-medium text-text-primary mb-2">No plans yet</h2>
            <p className="text-text-muted mb-8 max-w-sm mx-auto">
              Create your first plan to define work for the Orchestrator to execute.
            </p>
            <Link
              to="/plans/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-bg-deep font-medium rounded-lg transition-all duration-150 hover:shadow-glow-cyan active:scale-[0.98]"
            >
              <PlusIcon size="sm" />
              Create your first plan
            </Link>
          </div>
        )}

        {/* Attention sections - only shown when plans exist */}
        {!loading && !error && plans.length > 0 && (
          <div className="space-y-6">
            {/* Needs Attention section */}
            <NeedsAttentionSection plans={needsAttention} />

            {/* Working On section (hidden when empty) */}
            <WorkingOnSection plans={workingOn} />

            {/* All Plans section */}
            <CollapsibleSection
              sectionId="all-plans"
              title="All Plans"
              count={allOther.length}
            >
              {/* Controls row: Filter tabs + View mode toggle */}
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex gap-0.5 p-1 bg-bg-secondary/50 rounded-lg border border-border-subtle">
                  {FILTER_OPTIONS.map((option) => {
                    const isActive = filter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFilter(option.value)}
                        className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                          isActive
                            ? 'bg-bg-elevated text-text-primary shadow-sm'
                            : 'text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <PlansViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>

              {/* Search input */}
              <div className="mb-5 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search plans by goal, scope..."
                  className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Plans display */}
              {displayPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 mb-3 rounded-full bg-bg-tertiary flex items-center justify-center">
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <p className="text-text-secondary font-medium">
                    {searchQuery.trim() ? 'No matching plans' : 'No plans found'}
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    {searchQuery.trim()
                      ? 'Try adjusting your search terms'
                      : `No ${filter === 'all' ? '' : filter + ' '}plans in this category`}
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
  );
}
