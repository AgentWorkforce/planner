/**
 * ImportPlanModal - Modal for selecting a published plan to import
 *
 * Fetches published plans from the Planner API and allows the user
 * to select one to navigate to the preflight page.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';
import { listPublishedPlans, type PublishedPlanSummary } from '@/api/plans';

interface ImportPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportPlanModal({ open, onOpenChange }: ImportPlanModalProps) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PublishedPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Fetch plans when modal opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setSelectedPlanId(null);

      listPublishedPlans()
        .then((response) => {
          setPlans(response.plans);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load plans');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open]);

  const handleImport = () => {
    if (selectedPlanId) {
      onOpenChange(false);
      // Find the selected plan to get its version
      const selectedPlan = plans.find((p) => p.plan_id === selectedPlanId);
      // Navigate with version in query params if available
      const url = selectedPlan?.latest_version
        ? `/forge/preflight/${selectedPlanId}?version=${selectedPlan.latest_version}`
        : `/forge/preflight/${selectedPlanId}`;
      navigate(url);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Plan</DialogTitle>
          <DialogDescription>
            Select a published plan to import into the orchestrator for execution.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-error mb-4">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsLoading(true);
                  setError(null);
                  listPublishedPlans()
                    .then((response) => setPlans(response.plans))
                    .catch((err) => setError(err.message))
                    .finally(() => setIsLoading(false));
                }}
              >
                Retry
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <p>No published plans available.</p>
              <p className="text-sm text-text-muted mt-1">
                Publish a plan in the Planner to import it here.
              </p>
            </div>
          ) : (
            <>
              {/* Plan list */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {plans.map((plan) => (
                  <button
                    key={plan.plan_id}
                    onClick={() => setSelectedPlanId(plan.plan_id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all duration-150',
                      'hover:bg-bg-hover',
                      selectedPlanId === plan.plan_id
                        ? 'border-accent-cyan bg-accent-cyan/5'
                        : 'border-border-subtle'
                    )}
                  >
                    <div className="font-medium text-text-primary truncate">
                      {plan.goal || 'Untitled Plan'}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      {plan.scopes && plan.scopes.length > 0 && (
                        <>
                          <span className="px-1.5 py-0.5 rounded bg-bg-tertiary">
                            {plan.scopes[0]}
                          </span>
                          {plan.scopes.length > 1 && (
                            <span>+{plan.scopes.length - 1}</span>
                          )}
                          <span className="text-text-dim">|</span>
                        </>
                      )}
                      <span>v{plan.latest_version}</span>
                      <span className="text-text-dim">|</span>
                      <span>{new Date(plan.updated_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-subtle">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!selectedPlanId}
                >
                  Import Plan
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
