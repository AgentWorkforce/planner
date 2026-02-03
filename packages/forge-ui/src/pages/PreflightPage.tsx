/**
 * PreflightPage - Preflight checks before starting a run
 *
 * Displays plan summary, runs validation checks, allows environment selection,
 * and provides the ability to start forging (creating a run).
 */

import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PreflightIcon } from '@/components/icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button } from '@/components/ui/Button';
import { PlanSummaryCard } from '@/components/PlanSummaryCard';
import { PreflightChecklist } from '@/components/PreflightChecklist';
import { EnvironmentSelector } from '@/components/EnvironmentSelector';
import { StepsPreview } from '@/components/StepsPreview';
import { StartForgingDialog } from '@/components/StartForgingDialog';
import { usePreflight } from '@/hooks/usePreflight';
import type { Environment } from '@/types';

export function PreflightPage() {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get version from query params if provided
  const versionParam = searchParams.get('version');
  const version = versionParam ? parseInt(versionParam, 10) : undefined;

  // Preflight data
  const { plan, checks, isValid, isLoading, error, plannerAvailable, revalidate } =
    usePreflight(planId || '', version);

  // Environment selection
  const [environment, setEnvironment] = useState<Environment>('development');

  // Dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Handle cancel - go back to runs list
  const handleCancel = () => {
    navigate('/forge');
  };

  // Handle start forging click
  const handleStartForging = () => {
    setShowConfirmDialog(true);
  };

  // Loading state
  if (isLoading && !plan) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-border-subtle px-6 py-4">
          <h1 className="text-2xl font-display font-semibold text-text-primary">
            Pre-Flight Check
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-mono">
            Plan: {planId}
          </p>
        </div>

        {/* Loading */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-text-secondary">Loading plan...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state - Planner not available
  if (!plannerAvailable) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-border-subtle px-6 py-4">
          <h1 className="text-2xl font-display font-semibold text-text-primary">
            Pre-Flight Check
          </h1>
        </div>

        {/* Error */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-red-500/10 p-4">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-red-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Planner API Unavailable
            </h2>
            <p className="text-text-secondary mb-6">
              Could not connect to the Planner API. Please ensure the Planner backend is running on port 3000.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Go Back
              </Button>
              <Button variant="primary" onClick={revalidate}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - other errors
  if (error && !plan) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-border-subtle px-6 py-4">
          <h1 className="text-2xl font-display font-semibold text-text-primary">
            Pre-Flight Check
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-mono">
            Plan: {planId}
          </p>
        </div>

        {/* Error */}
        <div className="flex flex-1 items-center justify-center p-6">
          <ErrorMessage
            message={error}
            onRetry={revalidate}
          />
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center gap-3">
          <PreflightIcon size="lg" className="text-accent-cyan" />
          <div>
            <h1 className="text-2xl font-display font-semibold text-text-primary">
              Pre-Flight Check
            </h1>
            {plan && (
              <p className="text-sm text-text-secondary mt-0.5">
                {plan.goal}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Plan Summary Card */}
          {plan && <PlanSummaryCard plan={plan} />}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Preflight Checks */}
            <div className="space-y-6">
              <PreflightChecklist checks={checks} isLoading={isLoading} />

              {/* Environment Selector */}
              <div className="rounded-lg border border-border-subtle bg-bg-surface p-4">
                <EnvironmentSelector
                  value={environment}
                  onChange={setEnvironment}
                />
              </div>
            </div>

            {/* Right Column - Steps Preview */}
            {plan && (
              <StepsPreview steps={plan.steps} />
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-border-subtle px-6 py-4">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleStartForging}
            disabled={!isValid || isLoading}
          >
            Start Forging
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {plan && (
        <StartForgingDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          plan={plan}
          environment={environment}
        />
      )}
    </div>
  );
}
