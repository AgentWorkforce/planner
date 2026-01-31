import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { listPlans, updatePlan } from '@/api/plans';
import type { PlanSummary } from '@/types';

interface AddPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initiativeId: string;
  /** Called after plans are successfully added */
  onPlansAdded: () => void;
  /** IDs of plans already in this initiative (to exclude from list) */
  excludePlanIds?: string[];
}

/**
 * AddPlanSheet Component
 *
 * Sheet for adding existing plans to an initiative.
 * Features:
 * - Fetches unassigned plans (no initiative_id)
 * - Search/filter by plan goal
 * - Multi-select with checkboxes
 * - Bulk add selected plans
 *
 * @example
 * <AddPlanSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   initiativeId="init-123"
 *   onPlansAdded={() => refresh()}
 * />
 */
export function AddPlanSheet({
  open,
  onOpenChange,
  initiativeId,
  onPlansAdded,
  excludePlanIds = [],
}: AddPlanSheetProps) {
  const [availablePlans, setAvailablePlans] = useState<PlanSummary[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available plans when sheet opens
  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setSelectedPlanIds(new Set());
      setSearchQuery('');
      setError(null);
      return;
    }

    async function fetchPlans() {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all plans, we'll filter client-side
        const { plans } = await listPlans({ include_attention: false });
        // Filter to only unassigned plans (no initiative_id)
        const unassigned = plans.filter(
          (p) => !p.initiative_id && !excludePlanIds.includes(p.plan_id)
        );
        setAvailablePlans(unassigned);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
        setError('Failed to load plans');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlans();
  }, [open, excludePlanIds]);

  // Filter plans by search query
  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return availablePlans;
    const query = searchQuery.toLowerCase();
    return availablePlans.filter((plan) =>
      plan.goal.toLowerCase().includes(query)
    );
  }, [availablePlans, searchQuery]);

  // Toggle plan selection
  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  // Handle adding selected plans
  const handleAddPlans = async () => {
    if (selectedPlanIds.size === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      // Update each selected plan's initiative_id
      const updates = Array.from(selectedPlanIds).map((planId) =>
        updatePlan(planId, { initiative_id: initiativeId })
      );
      await Promise.all(updates);

      onPlansAdded();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to add plans:', err);
      setError('Failed to add some plans. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'info' | 'success' => {
    switch (status) {
      case 'approved':
        return 'info';
      case 'published':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Add Plans to Initiative</SheetTitle>
          <SheetDescription>
            Select existing plans to add to this initiative.
          </SheetDescription>
        </SheetHeader>

        {/* Search input */}
        <div className="relative mt-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plans..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent"
          />
        </div>

        {/* Plans list */}
        <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-bg-tertiary/50 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-error">{error}</div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              {availablePlans.length === 0
                ? 'No unassigned plans available'
                : 'No plans match your search'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlans.map((plan) => {
                const isSelected = selectedPlanIds.has(plan.plan_id);
                return (
                  <button
                    key={plan.plan_id}
                    type="button"
                    onClick={() => togglePlan(plan.plan_id)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-all duration-150
                      ${
                        isSelected
                          ? 'bg-accent-cyan/10 border-accent-cyan'
                          : 'bg-bg-tertiary/50 border-border-subtle hover:border-border-light'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div
                        className={`
                          mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                          ${
                            isSelected
                              ? 'bg-accent-cyan border-accent-cyan'
                              : 'border-border-default'
                          }
                        `}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-bg-deep"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Plan info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {plan.goal}
                          </span>
                          <Badge
                            variant={getStatusVariant(plan.status)}
                            className="flex-shrink-0"
                          >
                            {plan.status}
                          </Badge>
                        </div>
                        {plan.scopes && plan.scopes.length > 0 && (
                          <div className="text-xs text-text-muted truncate">
                            {plan.scopes.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="mt-4 pt-4 border-t border-border-subtle">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddPlans}
            disabled={selectedPlanIds.size === 0 || isSaving}
          >
            {isSaving ? (
              'Adding...'
            ) : (
              <>
                Add {selectedPlanIds.size > 0 ? `${selectedPlanIds.size} ` : ''}
                Plan{selectedPlanIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
