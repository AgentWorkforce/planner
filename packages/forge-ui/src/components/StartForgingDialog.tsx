/**
 * StartForgingDialog - Confirmation dialog for starting a run
 *
 * Shows a confirmation with environment warning and handles run creation.
 */

import { useState } from 'react';
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
import { createRun } from '@/api/preflight';
import type { ForgePlan, Environment } from '@/types';

interface StartForgingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ForgePlan;
  environment: Environment;
}

/**
 * Alert Icon for production warning
 */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Forge Icon for the dialog
 */
function ForgeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Hammer head */}
      <rect x="8" y="2" width="8" height="6" rx="1" />
      {/* Hammer handle */}
      <line x1="12" y1="8" x2="12" y2="16" />
      {/* Anvil top */}
      <path d="M6 16h12l1 2H5l1-2z" />
      {/* Anvil body */}
      <rect x="4" y="18" width="16" height="4" rx="1" />
    </svg>
  );
}

const ENVIRONMENT_LABELS: Record<Environment, string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
};

export function StartForgingDialog({
  open,
  onOpenChange,
  plan,
  environment,
}: StartForgingDialogProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProduction = environment === 'production';

  const handleConfirm = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const result = await createRun(plan.plan_id, { environment });

      // Navigate to the new run
      onOpenChange(false);
      navigate(`/forge/runs/${result.run_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create run';
      setError(message);
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    if (!isCreating) {
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent-cyan/10 p-2">
              <ForgeIcon className="h-5 w-5 text-accent-cyan" />
            </div>
            <DialogTitle>Start Forging</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Are you sure you want to start forging this plan?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Info */}
          <div className="rounded-md border border-border-subtle bg-bg-deep p-3">
            <div className="font-medium text-text-primary truncate">
              {plan.goal}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
              <span>v{plan.plan_version}</span>
              <span className="text-text-dim">|</span>
              <span>{plan.steps.length} steps</span>
            </div>
          </div>

          {/* Environment Notice */}
          {environment !== 'development' && (
            <div
              className={`flex items-start gap-3 rounded-md p-3 ${
                isProduction
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'bg-blue-500/10 border border-blue-500/30'
              }`}
            >
              {isProduction && (
                <AlertIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <div
                  className={`font-medium ${
                    isProduction ? 'text-amber-500' : 'text-blue-400'
                  }`}
                >
                  {ENVIRONMENT_LABELS[environment]} Environment
                </div>
                <div className="mt-0.5 text-sm text-text-secondary">
                  {isProduction
                    ? 'This will execute against the production environment. Please proceed with caution.'
                    : `This will execute in the ${environment} environment.`}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3">
              <div className="flex items-start gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-red-500 shrink-0 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <div>
                  <div className="font-medium text-red-500">Failed to create run</div>
                  <div className="mt-0.5 text-sm text-red-400">{error}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            variant={isProduction ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Creating...</span>
              </>
            ) : isProduction ? (
              'Start in Production'
            ) : (
              'Start Forging'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
